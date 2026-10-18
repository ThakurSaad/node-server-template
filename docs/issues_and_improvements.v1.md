# Issues & Improvement Roadmap

> Full-codebase review performed on 2026-07-16. Findings are ordered by severity; each includes the file reference and a recommended fix. Items marked **🔴 Critical** are security bugs that should be fixed before any production deployment.
>
> **✅ Status (2026-07-16): all 26 findings have been remediated** following `implementation_plan.md`. File references below describe the code as it was at review time and are kept for historical context. Two additional latent bugs were found and fixed during implementation: `http-status` was mis-imported in several files (making `httpStatus.UNAUTHORIZED` etc. `undefined`, so auth errors surfaced as 500s), and user documents were created with an incomplete GeoJSON `locationCoordinates` stub that broke 2dsphere indexing.

## 🔴 Critical — Security

### 1. `changePassword` stores the new password in **plaintext**

`src/app/module/auth/auth.service.ts:359`

```ts
await Auth.updateOne({ email }, { password: newPassword });
```

`updateOne` bypasses the `pre("save")` bcrypt hook in `Auth.ts`, so the raw password is written to the database. It also breaks future logins, because `bcrypt.compare` will never match a plaintext value. Note that `resetPassword` (line 314) correctly hashes with `hashPass()` — `changePassword` must do the same:

```ts
const hashedPassword = await hashPass(newPassword);
await Auth.updateOne({ email }, { password: hashedPassword });
```

### 2. Privilege escalation via `role` in the registration payload

`src/app/module/auth/auth.service.ts:54`

Registration accepts any value present in `EnumUserRole`, which includes `ADMIN` and `SUPER_ADMIN`. Anyone can `POST /auth/register` with `role: "SUPER_ADMIN"` and, after activation, receive a JWT that passes every `auth(config.auth_level.super_admin)` check.

**Fix:** force `role` to `USER` (or a whitelist of self-registerable roles) on the public endpoint; create admins only through a seeded super-admin or an admin-only endpoint.

### 3. Socket.IO connections are completely unauthenticated

`src/socket/socketHandlers.ts:11` — the handshake trusts a client-supplied `userId` query parameter with no token verification. Any client that knows (or guesses) a Mongo ObjectId can:

- impersonate that user in chat (`send_message`)
- read messages emitted to that user's room
- overwrite their location and online status

**Fix:** require the JWT in `socket.handshake.auth`, verify it in a Socket.IO middleware (`io.use(...)`), and derive `userId` from the token payload — never from the query string.

### 4. OTP endpoints are brute-forceable and ignore expiry

- `activateAccount` (auth.service.ts:129) and `forgetPassOtpVerify` (auth.service.ts:275) compare the code but **never check `activationCodeExpire` / `verificationCodeExpire`**. Expiry is enforced only by the cron sweep, so codes stay valid up to a minute past expiry — and indefinitely if the cron fails or the process was restarted.
- Neither endpoint is rate-limited (only `/auth/login` uses the limiter). A 6-digit code with unlimited attempts falls to brute force quickly, which turns `forgot-password` into an account-takeover vector.

**Fix:** check expiry inside the service, rate-limit all OTP endpoints, hash stored OTPs, and cap attempts per code (e.g., invalidate after 5 failures).

### 5. `isBlocked` is only checked at login, and tokens live for 365 days

- `auth` middleware (`src/app/middleware/auth.ts:33`) confirms the account exists but does not check `isBlocked` (or `isActive`), so blocking a user has no effect on their existing tokens.
- `.env.example` sets `JWT_EXPIRES_IN=365d` for the **access** token. Combined, a blocked/compromised account keeps full API access for up to a year.
- A refresh token is issued at login/activation, but **no refresh endpoint exists** — the refresh token is dead weight.

**Fix:** check `isBlocked`/`isActive` in the middleware (the `Auth` document is already being fetched), shorten access tokens to minutes/hours, and implement `POST /auth/refresh-token`.

### 6. NoSQL operator injection through `QueryBuilder.filter()`

`src/builder/queryBuilder.ts:61` passes leftover query params straight into `.find(queryObj)`. With Express's extended query parser, `?age[$ne]=0` arrives as `{ age: { $ne: "0" } }`, letting clients inject Mongo operators ($ne, $gt, $regex, …) into any list endpoint.

**Fix:** sanitize with `express-mongo-sanitize` (or strip keys starting with `$`/containing `.`), and/or validate query params per-endpoint with a schema.

## 🟠 High — Correctness bugs

### 7. `npm run make:file` is effectively broken

`src/util/generateModule.ts:43` hardcodes `const moduleName = "Test"` and writes into `path.join(__dirname, moduleFolder)` — i.e., **`src/util/test/`**, not `src/app/module/test/`. It ignores CLI arguments entirely.

**Fix:** read the name from `process.argv[2]` and target `src/app/module/<name>`; exit with an error when no name is given.

### 8. Cron job defined in a service file, with unawaited promises

`src/app/module/auth/auth.service.ts:409` — the cron registers as a side effect of importing the auth service (it will silently start in any process that imports the module, including future tests). Inside the callback, `updateFieldsWithCron(...)` is called **without `await`**, so the surrounding `try/catch` can never catch its rejections.

**Fix:** move scheduling into a dedicated `src/jobs/` bootstrap called from `server.ts`, and `await Promise.all([...])` inside the handler.

### 9. `uncaughtException` is logged but the process keeps running

`src/server.ts:19` — after an uncaught exception the process state is undefined; Node docs are explicit that you should exit. `SIGTERM` is also logged without closing the HTTP server or the Mongoose connection, so containers get hard-killed mid-request.

**Fix:** implement graceful shutdown — `server.close()` → `mongoose.disconnect()` → `process.exit(1)` on fatal errors.

### 10. Possible null dereference in socket controllers

`src/socket/socket.controller.ts:58,89` — `User.findByIdAndUpdate` can return `null` (user deleted mid-session), then `updatedUser.isOnline` throws. The handlers are typed `Promise<any>`, which hides this from the compiler.

**Fix:** null-check the result and replace `any` with typed payload interfaces.

### 11. Middleware ordering quirks in `app.ts`

`src/app.ts:25-32`:

- `app.get("/")` is registered **after** `app.use("/", routes)` — it works only because no module claims `GET /`, but the ordering is fragile.
- `NotFoundHandler` is mounted **after** `globalErrorHandler`. It functions (error handlers are skipped for normal requests), but the conventional and safer order is: routes → 404 handler → error handler.
- Dead commented-out `require` blocks (lines 9–15) should be deleted.

### 12. Admin registration is a dead flow

`auth.service.ts:82-94` — when `role === ADMIN`, the activation email is deliberately skipped, but the account is still created with `isActive: false` and an activation code that is never delivered. The admin can never activate or log in without manual DB edits.

**Fix:** either send admins the email too, or create them pre-activated via a protected admin-creation endpoint (see issue 2).

## 🟡 Medium — Hardening & configuration

### 13. Dependency hygiene

`package.json` contains packages that are wrong, unused, or misplaced:

| Package                      | Problem                                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------------------ |
| `mongo@^0.1.0`               | Abandoned 2013-era package; unused (Mongoose is the driver) — remove                                   |
| `stream@^0.0.3`              | Userland shadow of the Node built-in — remove                                                          |
| `ejs@^5.0.1`                 | No EJS usage found in `src/`; version also doesn't match the current 3.x line — remove or verify       |
| `mongodb@^7.1.0`             | Redundant alongside Mongoose unless used directly — remove                                             |
| `@types/chalk`               | Deprecated stub (chalk ships its own types) — remove                                                   |
| `ts-node-dev`, `body-parser` | Dev-only tool in `dependencies`; `body-parser` is built into Express 5 (`express.json()` already used) |

Also: `package-lock.json` is listed in `.gitignore` — lockfiles should be **committed** for reproducible installs.

### 14. Missing standard security middleware

`app.ts` has no `helmet` (security headers), no `compression`, no HTTP request logger (e.g., `morgan` piped into Winston), and no `app.set("trust proxy", 1)` — without the latter, `express-rate-limit` keys every request behind a reverse proxy to the proxy's IP, rate-limiting all users collectively.

### 15. Rate limiter responds with the wrong status code

`src/app/middleware/limiter.ts:12` sends `statusCode: 400`; rate limiting should return **429 Too Many Requests** so clients and proxies can back off correctly.

### 16. `.env.example` problems

- `NODE_DEV=production` is a typo — `src/config/index.ts` reads `NODE_ENV`, so `config.env` is always `undefined` (which also makes the error handler treat every environment as non-production and leak stack traces).
- Contains realistic-looking Stripe secret key and webhook secret — even test keys shouldn't be committed; use `sk_test_xxx` placeholders.
- `ACTIVATION_SECRET` and `STRIPE_WEBHOOK_SECRET` are defined but never read by `src/config/index.ts`.
- 365-day JWT lifetimes as documented defaults (see issue 5).

### 17. Weak config validation

`src/config/index.ts:8` — `validateConfig` takes `any` and only checks two values. SMTP credentials, refresh secret, and port go unvalidated, so misconfiguration surfaces as runtime failures deep in the stack. Consider a `zod` schema for the whole config object, giving both validation and inferred types.

### 18. No request-body validation layer

`validateFields` only checks key presence — no type, length, format, or sanitization rules. Adopt `zod` (or Joi) schemas per endpoint via a `validateRequest(schema)` middleware; this also removes hand-rolled checks scattered through services.

### 19. Upload and static-file gaps

- `multer` has no `limits` (file size / count) → disk-exhaustion risk (`fileUploader.ts:84`).
- `/uploads` is publicly served with no auth or caching policy (`app.ts:23`).
- Filenames use `Date.now() + originalname`, preserving user-controlled names; prefer a random UUID + validated extension.

### 20. Data-model scalability

- `Chat.messages` is an unbounded ObjectId array — a long conversation grows a single document toward Mongo's 16 MB cap and slows every chat read. Store `chatId` on each `Message` and query messages by chat instead.
- `Message.sender/receiver` and `Notification.toId` lack `ref`, blocking `populate`.
- No indexes beyond the implicit `email` unique — add indexes for hot queries (e.g., `Message.chatId`, `Notification.toId + isRead`, 2dsphere on `User.locationCoordinates`).

## 🟢 Improvements — Developer experience & operations

### 21. No automated tests or CI

There is zero test coverage and no pipeline. Minimum viable setup:

- **Vitest/Jest + Supertest + mongodb-memory-server** for the auth flows (registration → activation → login) and the QueryBuilder.
- **GitHub Actions** running `typecheck` → `lint:check` → `prettier:check` → tests on every PR.

### 22. No containerization

Add a multi-stage `Dockerfile` (build → slim runtime) and a `docker-compose.yml` with MongoDB for one-command local onboarding.

### 23. No API documentation endpoint

Endpoint knowledge lives only in the README. Add Swagger/OpenAPI (`swagger-jsdoc` + `swagger-ui-express`) or at least a committed Postman collection.

### 24. Inconsistent module style

- `Notification.ts` uses `export default` while every other model uses `export =` — pick one convention (prefer ESM `export default`/named exports with `esModuleInterop`).
- Mixed `require` and `import` in the same files (`auth.service.ts:1`, `auth.ts:2`, `socket.controller.ts:9`).
- `package.json` metadata is stale: `"name": "top-of-everest"`, `"main": "index.js"` (should be `dist/server.js`), no `engines` field.

### 25. Docs drift

`docs/project_technical_documentation.md` references a `dashboard/` module, `payments` collection, `unlinkFile.js`, and "3-digit" OTPs — none of which match the current code (there is no payment module; OTPs are 6-digit with a 3-minute expiry; files are `.ts`). Update or regenerate after the fixes above land.

### 26. Health check & observability

`GET /` returns a novelty string. Add a real `/health` endpoint (DB ping + uptime) for load balancers, and consider request-ID correlation in Winston logs.

---

## Suggested priority order

| Phase              | Items                       | Outcome                                 |
| ------------------ | --------------------------- | --------------------------------------- |
| 1 — Security patch | 1, 2, 3, 4, 5, 6            | Safe to expose publicly                 |
| 2 — Correctness    | 7, 8, 9, 10, 11, 12, 15, 16 | Template behaves as documented          |
| 3 — Hardening      | 13, 14, 17, 18, 19, 20      | Production-grade defaults               |
| 4 — DX & ops       | 21, 22, 23, 24, 25, 26      | Confident iteration for future projects |
