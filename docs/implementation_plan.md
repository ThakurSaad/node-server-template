# Remediation Implementation Plan — Express 5 + TypeScript + Mongoose + Socket.IO Backend Template

This plan turns the 26 findings in `docs/issues_and_improvements.md` into an ordered, executable roadmap. It is grounded in the actual code as of 2026-07-16 (verified file/line references). Work through the phases sequentially; within a phase, follow the step numbering — several fixes share files (`auth.service.ts`, `app.ts`, `server.ts`, `config/index.ts`) and are sequenced to avoid conflicts.

**Conventions used below**

- All paths are relative to the repo root (`server-setup-template-updated/`).
- "Issue N" refers to the numbering in `docs/issues_and_improvements.md`.
- Each phase ends with a verification checklist. Until Phase 4 lands automated tests, verification is `npm run typecheck` + `npm run lint:check` + manual curl/socket checks.
- Effort estimates: **S** ≤ ~1 hour, **M** = a few hours, **L** = a day or more.

**Cross-cutting ordering constraints (read first)**

1. **Issue 2 (role whitelisting) and Issue 12 (dead admin flow) are one design decision.** Whitelisting `role=USER` on `/auth/register` makes the `role === ADMIN` branch (`auth.service.ts:82-94`) unreachable dead code. Decide the admin-creation story before touching either (see "Owner decisions" below).
2. **Issue 5 (refresh endpoint, short tokens) depends on Issue 16/17** only for the `.env.example` lifetime values — implement the endpoint first, change documented defaults when editing `.env.example`.
3. **Issue 8 (cron relocation) must be done together with or before Issue 9 (graceful shutdown)** — the shutdown handler must stop the cron task, so the cron must expose a handle from `src/jobs/` rather than self-registering on import.
4. **Issue 17 (zod config validation) should land before Issue 16's `.env.example` rewrite is finalized** — the zod schema is the source of truth for which vars exist; regenerate `.env.example` from it.
5. **Issue 18 (zod request validation)** reuses the zod dependency added in Issue 17 — install `zod` once, in Phase 3, or early if you prefer (it has no interaction with Phase 1 fixes other than optionally replacing hand-rolled checks later).
6. **Issue 13 (dependency cleanup)** should precede Docker/CI (Issues 21–22) so images and pipelines don't bake in dead packages; committing `package-lock.json` is a prerequisite for reproducible CI.

**Decisions needing project-owner input (do not assume)**

| #   | Decision                                  | Options                                                                                                                                                               |
| --- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Admin creation strategy (Issues 2 + 12)   | (a) Seed one SUPER_ADMIN via script + protected `POST /admin/create-admin` endpoint (recommended); (b) allow ADMIN self-registration but require super-admin approval |
| D2  | Access-token lifetime (Issue 5)           | e.g. `15m` access / `30d` refresh — mobile-app clients must implement refresh; confirm client teams can absorb this                                                   |
| D3  | Existing production data (Issue 1)        | Are there deployed instances with plaintext passwords written by `changePassword`? If yes, a migration/forced-reset is needed                                         |
| D4  | `/uploads` exposure (Issue 19)            | Keep public static serving (with caching headers) vs. auth-gated download endpoint                                                                                    |
| D5  | Chat message storage migration (Issue 20) | New template projects only, or migrate existing `Chat.messages` arrays with a script                                                                                  |
| D6  | Test runner (Issue 21)                    | Vitest (recommended, pairs with `tsx`) vs. Jest                                                                                                                       |

---

## Phase 1 — Security patch (Issues 1–6) — Effort: **L**

Goal: safe to expose publicly. No new endpoints except `POST /auth/refresh-token`; one new dependency decision (mongo-sanitize approach).

### Step 1.1 — Fix plaintext password write (Issue 1)

**File:** `src/app/module/auth/auth.service.ts` (line 359)

- In `changePassword`, hash before writing, exactly as `resetPassword` (line 314) already does:
  ```ts
  const hashedPassword = await hashPass(newPassword);
  await Auth.updateOne({ email }, { password: hashedPassword });
  ```
- The `hashPass` helper already exists in this file (line 403) — no new code needed beyond the two-line change.

**Migration concern (D3):** any account whose password was changed via this endpoint since deployment now has a plaintext password in the DB that `bcrypt.compare` will never match. Options: (a) one-off script that detects non-bcrypt values (bcrypt hashes match `/^\$2[aby]\$/`) and forces those users through the forgot-password flow; (b) if the template has never been deployed, no action. Record the decision in the changelog.

### Step 1.2 — Whitelist self-registerable roles (Issue 2, pairs with Issue 12/D1)

**Files:** `src/app/module/auth/auth.service.ts` (lines 54, 82–94), `src/util/enum.ts` (read-only reference), new `src/app/module/admin/*` additions per D1.

1. In `registrationAccount`, replace the `EnumUserRole` membership check with a whitelist:
   ```ts
   const SELF_REGISTERABLE_ROLES = [EnumUserRole.USER];
   if (!SELF_REGISTERABLE_ROLES.includes(role as EnumUserRole))
     throw new ApiError(status.BAD_REQUEST, "Invalid role");
   ```
   (Or ignore the incoming `role` entirely and hardcode `role: EnumUserRole.USER` in `authData` — simpler; then drop `role` from `validateFields`. Pick one; hardcoding is safer for a public template.)
2. Delete the now-dead `if (role !== EnumUserRole.ADMIN)` guard at line 82 (always send the activation email) and the `if (role === EnumUserRole.ADMIN) await Admin.create(...)` branch at line 93 — this simultaneously resolves Issue 12's dead flow.
3. Per D1(a): add `createAdmin` to `src/app/module/admin/admin.service.ts` (create `Auth` with `isActive: true`, no activation code, plus `Admin` profile; use `Auth.create` so the `pre("save")` hook hashes the password) and expose it in `src/app/module/admin/admin.routes.ts` behind `auth(config.auth_level.super_admin)`. Add a seed script `src/scripts/seedSuperAdmin.ts` (reads credentials from env, idempotent upsert) and a `"seed:admin": "tsx src/scripts/seedSuperAdmin.ts"` npm script.

### Step 1.3 — Authenticate Socket.IO handshakes (Issue 3)

**Files:** `src/connection/socket.ts`, `src/socket/socketHandlers.ts`, new `src/socket/socketAuth.ts`.

1. Create `src/socket/socketAuth.ts` — a Socket.IO middleware:
   - Read token from `socket.handshake.auth.token` (fallback: `Authorization` header for tooling), verify with `jwtHelpers.verifyToken<AuthUserPayload>(token, config.jwt.secret)`.
   - Load `Auth.findById(payload.authId)`; reject if missing, `isBlocked`, or `!isActive` (mirrors Step 1.5's HTTP middleware).
   - Attach `socket.data.user = payload` and call `next()`; on failure call `next(new Error("Unauthorized"))` (Socket.IO middleware errors are delivered to the client as `connect_error`).
2. In `src/connection/socket.ts`, register `io.use(socketAuth)` before the `CONNECTION` handler.
3. In `src/socket/socketHandlers.ts` (line 11), replace `socket.handshake.query.userId` with `socket.data.user.userId`. `SocketController.validateUser` can stay as a defensive existence check but no longer trusts client input; `updateLocation`/`sendMessage` payload spreads (`{ ...payload, userId }`) must place `userId` **after** the spread — they already do, but confirm `userId` now comes from `socket.data.user`.
4. Type `socket.data` via a `SocketData` interface in `src/socket/socket.types.ts` (feeds Issue 10's typing work in Phase 2).

**Breaking change:** all socket clients must send `{ auth: { token } }` in the handshake instead of `?userId=` query — document in README.

### Step 1.4 — OTP expiry checks, rate limiting, attempt caps (Issue 4)

**Files:** `src/app/module/auth/auth.service.ts` (lines 129–186, 275–297), `src/app/module/auth/Auth.ts`, `src/app/module/auth/auth.routes.ts`, `src/app/middleware/limiter.ts`.

1. **Expiry checks in services.** In `activateAccount`, after the code-match check, add:
   ```ts
   if (!auth.activationCodeExpire || auth.activationCodeExpire < new Date())
     throw new ApiError(
       status.BAD_REQUEST,
       "Activation code expired. Request a new one",
     );
   ```
   Mirror for `forgetPassOtpVerify` with `verificationCodeExpire`. Note `Auth.isAuthExist` projection (Auth.ts:84) doesn't include the code/expiry fields — these two services already use `Auth.findOne({ email })` directly, so the fields are available; no projection change needed.
2. **Attempt caps.** Add `activationAttempts?: number` and `verificationAttempts?: number` to `IAuth` and `AuthSchema`. On mismatch, `$inc` the counter; when it reaches 5, `$unset` the code/expiry and throw "Too many attempts. Request a new code". Reset the counter whenever a new code is issued (`registrationAccount`, `resendActivationCode`, `forgotPass`).
3. **Hash stored OTPs** (optional-but-recommended sub-step; the codes are short-lived): store `bcrypt.hash(code, ...)` or an HMAC-SHA256 of the code, compare accordingly in the two verify services. If you skip this, note it explicitly in the doc.
4. **Rate limiting.** Refactor `src/app/middleware/limiter.ts` to export a factory `createLimiter({ windowMs, limit })` (keep a default export for `/login` compatibility), and apply limiters in `auth.routes.ts` to `/activate-account`, `/activation-code-resend`, `/forgot-password`, `/forget-pass-otp-verify`, and `/reset-password`. Suggested: 5 requests / 15 min for verify endpoints, 3 / 15 min for send endpoints. (Status-code fix for the limiter response is Issue 15, Phase 2 — do it here instead if convenient, since you're already editing the file: change `statusCode: 400` → `429` at `limiter.ts:12`.)

### Step 1.5 — Enforce `isBlocked`/`isActive` in auth middleware + refresh flow (Issue 5)

**Files:** `src/app/middleware/auth.ts` (line 33), `src/app/module/auth/auth.service.ts`, `auth.controller.ts`, `auth.routes.ts`, `.env.example` (finalized in Phase 2/3).

1. In `src/app/middleware/auth.ts`, after `const isExist = await Auth.findById(verifyUser.authId);`:
   ```ts
   if (isExist.isBlocked)
     throw new ApiError(
       httpStatus.FORBIDDEN,
       "You are blocked. Contact support",
     );
   if (!isExist.isActive)
     throw new ApiError(httpStatus.FORBIDDEN, "Account is not activated");
   ```
2. **New endpoint `POST /auth/refresh-token`:**
   - `auth.service.ts`: add `refreshToken(token: string)` — verify with `config.jwt.refresh_secret` via `jwtHelpers.verifyToken`, re-load the `Auth` doc, re-check `isActive`/`isBlocked`, re-resolve the profile id (Admin vs User, same switch as `loginAccount`), issue a fresh access token (and optionally rotate the refresh token). Export from `AuthService`.
   - `auth.controller.ts`: add a `refreshToken` handler reading the token from `req.body.refreshToken` (or the `refreshToken` cookie — `cookie-parser` is already mounted; supporting both is cheap).
   - `auth.routes.ts`: `.post("/refresh-token", AuthController.refreshToken)` — no `auth()` middleware (it authenticates via the refresh token itself), but add a rate limiter.
3. Shorten documented lifetimes: `JWT_EXPIRES_IN=15m`, `JWT_REFRESH_EXPIRES_IN=30d` (subject to D2). The actual `.env.example` edit lands with Issue 16 in Phase 2; make sure both changes agree.

**Breaking change (D2):** clients holding 365-day tokens keep working until expiry (tokens aren't revoked), but new logins get short tokens — client apps must implement the refresh call before this ships to any consuming frontend.

### Step 1.6 — Neutralize NoSQL operator injection (Issue 6)

**Files:** `src/builder/queryBuilder.ts` (`filter()`, lines 53–64), `src/app.ts`.

1. **Primary fix in `QueryBuilder.filter()`** (dependency-free, Express-5-safe): after deleting the exclude fields, sanitize:
   ```ts
   const sanitized: Record<string, unknown> = {};
   for (const [key, value] of Object.entries(queryObj)) {
     if (key.startsWith("$") || key.includes(".")) continue;
     if (typeof value === "string") sanitized[key] = value;
     // drop objects/arrays entirely — operators arrive as nested objects
   }
   this.modelQuery = this.modelQuery.find(sanitized);
   ```
   Also sanitize `searchTerm` in `search()` — it's interpolated into `$regex`; escape regex metacharacters (`searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")`) to prevent ReDoS/regex injection.
2. **Optional defense-in-depth:** `express-mongo-sanitize` historically breaks on Express 5 (it reassigns `req.query`, which is a getter in Express 5). Do **not** add it blindly. Alternatives: set `app.set("query parser", "simple")` in `src/app.ts` so bracketed params never parse into nested objects (verify no endpoint relies on `?a[b]=c` arrays first — QueryBuilder consumers only use flat params), or write a tiny in-house sanitize middleware over `req.body`/`req.params`. Recommend: QueryBuilder fix (mandatory) + `"query parser", "simple"` (cheap, template-wide).

### Phase 1 verification

- `npm run typecheck` and `npm run lint:check` pass.
- Manual curl script (run against a local Mongo):
  1. `POST /auth/register` with `role: "SUPER_ADMIN"` → 400.
  2. Register USER → activate with expired/wrong code ×5 → code invalidated; correct fresh code → tokens issued.
  3. `PATCH /auth/change-password` → then log out/in with the new password (proves hashing); inspect the DB document to confirm `$2b$...` prefix.
  4. `POST /auth/refresh-token` with the refresh token → new access token; with garbage → 401.
  5. Set `isBlocked: true` in DB → any authed request with a still-valid access token → 403.
  6. `GET /review/get-all-reviews?age[$ne]=0` (any QueryBuilder-backed list route) → operator stripped, no filter leak.
  7. Socket client without `auth.token` → `connect_error`; with a valid token → connected, and a second client cannot join another user's room by guessing an id.

---

## Phase 2 — Correctness (Issues 7–12, 15, 16) — Effort: **M**

### Step 2.1 — Fix `npm run make:file` (Issue 7)

**File:** `src/util/generateModule.ts` (lines 12, 43–45).

- Read `const moduleName = process.argv[2];` — if absent, `console.error("Usage: npm run make:file -- <ModuleName>"); process.exit(1);`.
- Normalize casing (capitalize first letter for templates, lowercase for folder).
- Target `path.join(process.cwd(), "src", "app", "module", moduleFolder)` instead of `path.join(__dirname, moduleFolder)`.
- Delete the stray `src/util/test/` directory if it was ever generated (none exists in the current tree).
- Optionally print a reminder to register the new router in `src/app/routes/index.ts`.

### Step 2.2 — Relocate the cron job (Issue 8) — do together with 2.3

**Files:** `src/app/module/auth/auth.service.ts` (lines 362–416), new `src/jobs/index.ts` (+ `src/jobs/otpCleanup.job.ts`), `src/server.ts`.

1. Move `updateFieldsWithCron` out of the service into `src/jobs/otpCleanup.job.ts` (it touches only `Auth` and `logger`).
2. Create `src/jobs/index.ts`:
   ```ts
   import cron, { ScheduledTask } from "node-cron";
   const tasks: ScheduledTask[] = [];
   export const startJobs = () => {
     tasks.push(
       cron.schedule("* * * * *", async () => {
         try {
           await Promise.all([
             updateFieldsWithCron("activation"),
             updateFieldsWithCron("verification"),
           ]);
         } catch (error) {
           logger.error("Error removing expired code:", error);
         }
       }),
     );
   };
   export const stopJobs = () => tasks.forEach((t) => t.stop());
   ```
   Note the added `await Promise.all` — the current code fires both calls unawaited, so the `try/catch` is dead.
3. Delete the `cron.schedule` block and the `import cron` from `auth.service.ts`.
4. Call `startJobs()` in `src/server.ts` after `connectDB()` succeeds.

**Interaction:** with Step 1.4's expiry checks in place, the cron is now belt-and-braces cleanup, not the security boundary — safe to keep at 1-minute cadence or relax to 5 minutes.

### Step 2.3 — Graceful shutdown and fatal-error exit (Issue 9)

**File:** `src/server.ts` (whole file).

- Capture the server handle: `const server = mainServer.listen(...)`.
- Implement one `shutdown(exitCode: number)` helper: `stopJobs()` → `server.close()` (await via promise) → optionally `io.close()` (consider exporting `io` from `src/connection/socket.ts` alongside `mainServer` so sockets disconnect cleanly) → `mongoose.disconnect()` → `process.exit(exitCode)`; wrap with a 10s hard-kill timeout.
- `uncaughtException` / `unhandledRejection` → log then `shutdown(1)`. `SIGTERM` / `SIGINT` → log then `shutdown(0)`.
- Register `uncaughtException` **before** `await connectDB()` (currently handlers are registered only after a successful connect); also make the `catch` in `main()` call `process.exit(1)` instead of just logging.

**Ordering:** requires Step 2.2's `stopJobs` export.

### Step 2.4 — Null-safe, typed socket controllers (Issue 10)

**Files:** `src/socket/socket.controller.ts` (lines 47–61, 75–91), `src/socket/socket.types.ts`.

- In `updateOnlineStatus` and `updateLocation`: null-check `updatedUser`; on null, `emitError(socket, status.NOT_FOUND, "User not found")` and return.
- Replace `Promise<any>` with typed payloads: define `UpdateOnlineStatusPayload { userId: string; isOnline: boolean }` and `UpdateLocationPayload { userId: string; lat: number; long: number }` in `socket.types.ts`; adjust `socketCatchAsync`'s generic signature if it forces `Record<string, unknown>` (check `src/util/socketCatchAsync.ts`).
- With Step 1.3 done, `userId` originates server-side; remove it from `validateSocketFields` required lists where redundant.

### Step 2.5 — App middleware ordering cleanup (Issue 11)

**File:** `src/app.ts`.

- Delete commented-out `require` block (lines 9–15).
- Reorder to: parsers/cors/static → `app.get("/", ...)` (or fold into Issue 26's `/health` later) → `app.use("/", routes)` → `NotFoundHandler.handle` → `globalErrorHandler` (error handler **last**).
- This is also where Phase 3's `helmet`/`compression`/`morgan`/`trust proxy` (Issue 14) and the `"query parser"` setting (Step 1.6) will slot in — if you prefer fewer passes over `app.ts`, batch 2.5 with 3.2.

### Step 2.6 — Resolve dead admin registration (Issue 12)

Already resolved by Step 1.2 (branches deleted, protected admin-creation endpoint added). Verify no other code path creates `Admin` docs with inactive `Auth` records: check `admin.service.ts` and `admin.controller.ts` when implementing D1.

### Step 2.7 — Rate limiter 429 (Issue 15)

**File:** `src/app/middleware/limiter.ts` (line 12) — `statusCode: 429` (use `status.TOO_MANY_REQUESTS` from `http-status`). Also pass `statusCode: 429` at the top level of the `rateLimit()` options so the HTTP status (not just the JSON body) is 429. If done in Step 1.4, mark complete.

### Step 2.8 — Fix `.env.example` (Issue 16)

**File:** `.env.example`.

- Line 1: `NODE_DEV=production` → `NODE_ENV=development` (pick `development` as the template default so devs don't accidentally run prod-mode locally; the error-handler stack-leak concern is fixed by the var existing at all).
- Replace real-looking Stripe keys (lines 22–23) with `sk_test_xxxxxxxxxxxx` / `whsec_xxxxxxxxxxxx` placeholders. **Also rotate/revoke the committed Stripe test keys in the Stripe dashboard** — they are in git history regardless.
- Remove `ACTIVATION_SECRET` (unread by `src/config/index.ts`); nothing references it.
- `JWT_EXPIRES_IN=15m`, `JWT_REFRESH_EXPIRES_IN=30d` (per D2, consistent with Step 1.5).
- Add any vars the seed script from Step 1.2 introduces (e.g. `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD`).
- **Interaction:** hold final sign-off on this file until Step 3.3's zod schema exists, then diff `.env.example` against the schema so they can never drift.

### Phase 2 verification

- `npm run typecheck`, `npm run lint:check`.
- `npm run make:file -- Demo` creates `src/app/module/demo/` with 4 files; running it again reports "already exists"; delete the generated module afterward (it's a scaffold test).
- Start the server, `Ctrl+C` → logs show jobs stopped, HTTP closed, Mongo disconnected, clean exit code.
- Throw a deliberate error in a test route → process exits (uncaughtException path) — remove the test route after.
- Hit `/auth/login` 11× → HTTP 429 with 429 in the body.
- `curl http://localhost:8001/nonexistent` → 404 JSON from `NotFoundHandler`, and `/` still returns the welcome payload.

---

## Phase 3 — Hardening (Issues 13, 14, 17–20) — Effort: **L**

### Step 3.1 — Dependency hygiene (Issue 13)

**Files:** `package.json`, `.gitignore`.

- `npm uninstall mongo stream ejs mongodb @types/chalk body-parser` — before removing `mongodb`, grep for direct imports (none exist in `src/`; Mongoose vendors its own driver). No EJS usage exists in `src/` (templates in `src/mail/` are TS string builders).
- Move `ts-node-dev` to `devDependencies` — or remove it entirely and switch the `dev` script to `tsx watch src/server.ts` (tsx is already a devDependency and powers `make:file`); removing is cleaner.
- Remove `package-lock.json` from `.gitignore` and commit the lockfile (`npm install` to regenerate, then `git add package-lock.json`).
- While here (fronts part of Issue 24): set `"main": "dist/server.js"`, add `"engines": { "node": ">=20" }`, fix `"name"`/`"description"`.

### Step 3.2 — Standard security middleware (Issue 14)

**Files:** `src/app.ts`, `package.json`.

- `npm install helmet compression morgan` + `npm install -D @types/morgan @types/compression`.
- In `app.ts` (respecting Step 2.5's final ordering): `app.set("trust proxy", 1);` → `app.use(helmet());` → `app.use(compression());` → `app.use(morgan("combined", { stream: { write: (msg) => logger.info(msg.trim()) } }));` (check `src/util/logger.ts` for available levels; add an `http` level if desired).
- Note: `helmet()` sets `Cross-Origin-Resource-Policy: same-origin`, which will block cross-origin `<img>` loads from `/uploads` — if D4 keeps uploads public for a separate frontend origin, configure `helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } })` or scope headers per-route.

### Step 3.3 — zod config validation (Issue 17)

**Files:** `src/config/index.ts` (rewrite), `package.json`.

- `npm install zod`.
- Define an `envSchema = z.object({ NODE_ENV: z.enum(["development","production","test"]).default("development"), PORT: z.coerce.number().default(8001), MONGO_URL: z.string().url(), JWT_SECRET: z.string().min(32), JWT_REFRESH_SECRET: ..., SMTP_*: ..., BCRYPT_SALT_ROUNDS: z.coerce.number().default(10), ... })`, parse `process.env` once, and build the existing `config` object shape from the parsed result so **no consumer changes** (`config.jwt.secret` etc. keep their paths but become non-optional strings — this also removes the fragile `as SignOptions["expiresIn"]` casts and the `Number(config.port)` coercion in `server.ts`).
- On parse failure, print the flattened issues and `process.exit(1)`.
- Keep `export = config` (module-style consistency is Issue 24; don't churn it here).
- **Interaction:** finalize `.env.example` (Step 2.8) against this schema; every schema key must appear in the example file.

### Step 3.4 — Request-body validation layer (Issue 18)

**Files:** new `src/app/middleware/validateRequest.ts`, new `<module>.validation.ts` files, route files.

- Add `validateRequest(schema: ZodSchema)` middleware: `schema.parseAsync({ body: req.body, query: req.query, params: req.params })`, write parsed body back to `req.body`, map `ZodError` → 400 via `globalErrorHandler` (add a `handleZodError` in `src/error/` mirroring `handleValidationError.ts`, and register it in `globalErrorHandler.ts`).
- Start with `src/app/module/auth/auth.validation.ts` (register, login, activate, forgot/reset/change password, refresh) and wire into `auth.routes.ts`. Migrate other modules incrementally; leave `validateFields` in place for un-migrated services (removal is a follow-up, not a blocker).
- **Interaction:** zod schemas can enforce password strength (min length etc.) — decide policy with the owner or default to `min(8)`.

### Step 3.5 — Upload hardening (Issue 19)

**Files:** `src/app/middleware/fileUploader.ts` (line 84), `src/app.ts` (line 23).

- Add `limits: { fileSize: 5 * 1024 * 1024, files: 4 }` to the `multer()` options; `src/error/handleMulterError.ts` already exists — confirm it maps `LIMIT_FILE_SIZE` to a 413/400.
- Replace the filename generator: `const ext = path.extname(file.originalname).toLowerCase();` validate ext against a per-mimetype allowlist, then `crypto.randomUUID() + ext`. This changes the stored-path format — `req.uploadedFiles` bookkeeping is unchanged, but grep for any code that parses original names from paths (`grep -r "originalname"`).
- Static serving per D4: at minimum `express.static("uploads", { maxAge: "1d", immutable: true, index: false, dotfiles: "deny" })`; if auth-gated, replace with a controller route using `res.sendFile` behind `auth(...)`.

### Step 3.6 — Data-model scalability (Issue 20)

**Files:** `src/app/module/chat/Chat.ts`, `src/app/module/chat/Message.ts`, `src/app/module/chat/chat.service.ts`, `src/socket/chat.socket.controller.ts`, `src/app/module/notification/Notification.ts`, `src/app/module/user/User.ts`.

1. Add `chatId: { type: Schema.Types.ObjectId, ref: "Chat", required: true, index: true }` to `Message`; stop pushing into `Chat.messages` in `chat.socket.controller.ts` / `chat.service.ts`; change message-list queries to `Message.find({ chatId })` with pagination. Keep `Chat.messages` temporarily deprecated or remove outright per D5 (template-only → remove; deployed data → write `src/scripts/migrateChatMessages.ts` that backfills `chatId` from the arrays, then drops the array).
2. Add `ref: "User"` to `Message.sender`/`receiver` and `Notification.toId` so `populate` works.
3. Indexes: `MessageSchema.index({ chatId: 1, createdAt: -1 })`, `NotificationSchema.index({ toId: 1, isRead: 1 })`, `UserSchema.index({ locationCoordinates: "2dsphere" })` (verify the `locationCoordinates` sub-schema is GeoJSON `{ type: "Point", coordinates: [] }` in `User.ts` first — the socket controller writes `{ coordinates: [long, lat] }`, so the `type` field default must survive for 2dsphere to work).

### Phase 3 verification

- Fresh clone simulation: delete `node_modules`, `npm ci` (lockfile now committed), `npm run build` succeeds.
- Boot with a deliberately missing `JWT_SECRET` → clean zod error listing the missing key, exit 1.
- `curl -X POST /auth/register` with a 3-char password → 400 zod error envelope.
- Upload a 20 MB file → 413/400 via multer limits; uploaded file lands as `<uuid>.png`.
- `curl -I /` → helmet headers present (`Content-Security-Policy`, `X-Content-Type-Options`); behind a local nginx/proxy test, rate limit keys per client IP.
- In mongosh: `db.messages.getIndexes()` shows the compound index; send a chat message over socket → `Message` doc has `chatId`, `Chat.messages` untouched/absent.

---

## Phase 4 — DX & ops (Issues 21–26) — Effort: **L**

### Step 4.1 — Tests + CI (Issue 21) — do first in this phase; everything else gains a safety net

**Files:** new `vitest.config.ts`, `tests/` (or `src/**/*.test.ts`), `.github/workflows/ci.yml`, `package.json` scripts.

- `npm install -D vitest supertest @types/supertest mongodb-memory-server` (per D6).
- Structural prerequisite: `src/app.ts` already exports the Express app — good for Supertest. But **importing `app` must not start crons or sockets**; Step 2.2 already ensured that. Also `src/config/index.ts` parses env at import — provide `tests/setup.ts` that sets required env vars before imports, or a `.env.test`.
- Minimum suites: (a) auth flow: register → activate (read code from the in-memory DB) → login → refresh → change-password → login with new password; (b) QueryBuilder: operator-injection stripping, search escaping, pagination meta; (c) OTP brute-force lockout.
- `.github/workflows/ci.yml`: Node 20/22 matrix, `npm ci` → `npm run typecheck` → `npm run lint:check` → `npm run prettier:check` → `npm test`.
- Add `"test": "vitest run"` and `"test:watch": "vitest"` scripts.

### Step 4.2 — Containerization (Issue 22)

**Files:** new `Dockerfile`, `docker-compose.yml`, `.dockerignore`.

- Multi-stage: `node:22-alpine` build stage (`npm ci`, `npm run build`) → runtime stage (`npm ci --omit=dev`, copy `dist/`, non-root user, `CMD ["node", "dist/server.js"]`). Note `bcrypt` is a native module — keep build/runtime base images identical, or switch to `bcryptjs` (owner call; keeping bcrypt with matched images is fine).
- `docker-compose.yml`: app + `mongo:7` service, env from `.env`, healthcheck hitting `/health` (Step 4.6 — land 4.6 before or with this).
- Graceful shutdown from Step 2.3 makes `SIGTERM` handling container-correct.

### Step 4.3 — API documentation (Issue 23)

- Lightest viable option: `npm install swagger-ui-express` + a hand-maintained `docs/openapi.yaml` served at `/docs` (gate behind non-production or basic auth). `swagger-jsdoc` annotations are an alternative but noisy; with zod schemas in place, consider `zod-to-openapi` later. Start with the auth module's endpoints including the new `/auth/refresh-token`.

### Step 4.4 — Module-style consistency + package metadata (Issue 24)

- Convert `export =`/`require` mixtures to ESM-style `import`/`export default` across `src/` (files verified using `export =`: `app.ts`, `auth.ts` middleware, `Auth.ts`, `limiter.ts`, `socketHandlers.ts`, `socket.controller.ts`, `connection/socket.ts`, `config/index.ts`, `auth.routes.ts`; `const { status } = require("http-status")` appears in `auth.service.ts:1`, `auth.ts:2`, `socket.controller.ts:9`). Requires `esModuleInterop: true` in `tsconfig.json` (verify) and is a wide mechanical change — **do it after tests exist** (Step 4.1) and in a single dedicated commit. `http-status` v2 imports as `import { status } from "http-status"`.
- `package.json` metadata was fixed in Step 3.1; confirm.

### Step 4.5 — Docs refresh (Issue 25)

- Rewrite `docs/project_technical_documentation.md` to match reality: no `dashboard/` or payments module, 6-digit OTP / 3-min expiry (see `src/util/codeGenerator.ts` — `codeGenerator(3)` is minutes, not digits; document precisely), `.ts` utilities, new `/auth/refresh-token`, socket handshake auth, `/health`. Do this **last** in the phase so it documents the final state. Update the README socket-client and env-setup sections (breaking changes from Steps 1.3, 1.5).

### Step 4.6 — Health endpoint + observability (Issue 26)

**Files:** `src/app.ts` (or a new `src/app/module/health/`), `src/util/logger.ts`.

- `GET /health`: return `{ status, uptime: process.uptime(), db: mongoose.connection.readyState === 1 ? "up" : "down" }` with 200/503; keep it out of auth and rate limiting.
- Request-ID correlation: generate `crypto.randomUUID()` per request in a tiny middleware, set `res.setHeader("X-Request-Id", id)`, include it in the morgan format and expose via `req.id` (extend `src/types/express.d.ts`, which already augments `Request` for `uploadedFiles`).

### Phase 4 verification

- `npm test` green locally and in the GitHub Actions run on a PR.
- `docker compose up` → app connects to compose Mongo, `/health` returns 200, `docker compose stop` shows graceful shutdown logs.
- `/docs` renders the OpenAPI UI listing auth endpoints.
- Full regression of Phase 1 manual curl script (now mostly covered by automated tests).

---

## Summary table

| Phase         | Issues        | New deps                                                     | Removed deps                                                        | Effort | Breaking changes                                                                                                                       |
| ------------- | ------------- | ------------------------------------------------------------ | ------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| 1 Security    | 1–6           | (none mandatory)                                             | —                                                                   | L      | Socket handshake auth; short token lifetimes + refresh required; role param ignored on register; possible plaintext-password migration |
| 2 Correctness | 7–12, 15, 16  | —                                                            | —                                                                   | M      | 429 instead of 400 on rate limit; `.env` var rename `NODE_DEV`→`NODE_ENV`                                                              |
| 3 Hardening   | 13, 14, 17–20 | helmet, compression, morgan, zod (+types)                    | mongo, stream, ejs, mongodb, @types/chalk, body-parser, ts-node-dev | L      | Stricter body validation (400s where none before); random upload filenames; Chat message storage shape (D5)                            |
| 4 DX & ops    | 21–26         | vitest, supertest, mongodb-memory-server, swagger-ui-express | —                                                                   | L      | ESM conversion is internal-only                                                                                                        |
