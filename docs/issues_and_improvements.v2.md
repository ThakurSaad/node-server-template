# Issues & Improvements — v2

> Full re-review on 2026-10-18 of branch `merger-branch` (working tree incl. uncommitted doc deletions).
> Scope: verify every item from `issues_and_improvements.v1.md` and `template_review_and_improvements.v1.md`, then find new issues.
> Rule of thumb for every fix below: **smallest change that removes the real failure** — no new layers or libraries.
>
> **Updated 2026-10-18:**
>
> - **C3 (malware) is fixed.** `.vscode/` was removed from every branch, local and `origin`, and is now git-ignored. VS Code was hardened and secrets were rotated.
> - **Docker and CI were removed on purpose**, to be added later (`Dockerfile`, `docker-compose.yml`, `.dockerignore`, `.github/workflows/ci.yml`, plus the README sections).

**Toolchain status**

| Check                    | Result                                                             |
| ------------------------ | ------------------------------------------------------------------ |
| `npm run typecheck`      | ✅ passes                                                          |
| `npm test`               | ✅ 21/21 pass                                                      |
| `npm run lint:check`     | ❌ fails — no ESLint config exists (see v1 #21)                    |
| `npm run prettier:check` | ❌ fails on 112 files — files are committed with CRLF (see v1 #21) |

---

## 1. Summary

**v1 verification (35 items):** ✅ 22 fixed · ⚠️ 9 partial · ❌ 2 not fixed · ➖ 2 no longer apply

**New issues (25):** ✅ 1 fixed (C3) · **24 open:** 🔴 Critical 2 · 🟠 High 3 · 🟡 Medium 9 · 🟢 Low 10

The migration and the v1 security fixes are mostly solid. The main themes now are:

1. ~~**Malware leftovers** still in the repo/branches.~~ ✅ Cleaned.
2. **Process-crash vector** — v1 #9 (exit on `unhandledRejection`) is correct, but several promises are still fired without `await`, so a failing email or a missing file now kills the server.
3. **Missing ownership checks** (IDOR) in chat, notification, review and feedback modules.
4. **Tooling drift** — lint and format checks fail locally (no ESLint config, CRLF line endings); the README links to deleted docs. Fix these before CI comes back.

---

## 2. v1 verification

### `issues_and_improvements.v1.md`

| #   | Item                                   | Status | Evidence                                                                            | Follow-up                                                                                                                                                                                                                                |
| --- | -------------------------------------- | ------ | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `changePassword` stored plaintext      | ✅     | `auth.service.ts:478-480` hashes via `hashPass`                                     | —                                                                                                                                                                                                                                        |
| 2   | Role escalation on register            | ✅     | `auth.service.ts:83-85` whitelist; `POST /admin/create-admin` + `seed:admin`        | —                                                                                                                                                                                                                                        |
| 3   | Unauthenticated sockets                | ✅     | `socket/socketAuth.ts` JWT in handshake; `socketHandlers.ts:11` uses token `userId` | Location broadcast leak → **M6**                                                                                                                                                                                                         |
| 4   | OTP brute force / expiry               | ⚠️     | Expiry checked (`auth.service.ts:170,342`), attempt cap, OTP rate limits ✅         | OTPs still **stored in plaintext** and generated with `Math.random` (`codeGenerator.ts:2`); `/register` not limited → **M2**                                                                                                             |
| 5   | `isBlocked` + 365d tokens + no refresh | ✅     | `middleware/auth.ts:37-45`; 15m default; `/auth/refresh-token`                      | Tokens survive password change → **M3**                                                                                                                                                                                                  |
| 6   | NoSQL injection via `QueryBuilder`     | ✅     | `app.ts:28` simple query parser + `queryBuilder.ts:68-72` sanitizer, tested         | Request **bodies** still unprotected → template 2C                                                                                                                                                                                       |
| 7   | `make:file` broken                     | ✅     | `generateModule.ts:54-61` reads argv, targets `src/app/module/<name>`               | —                                                                                                                                                                                                                                        |
| 8   | Cron in service, unawaited             | ✅     | `src/jobs/`, started from `server.ts:60`, `Promise.all` awaited                     | —                                                                                                                                                                                                                                        |
| 9   | No graceful shutdown                   | ✅     | `server.ts:12-49`                                                                   | Now turns every unawaited rejection into a crash → **C1**                                                                                                                                                                                |
| 10  | Socket null deref                      | ✅     | `socket.controller.ts:60,88` null checks, typed payloads                            | `payload: any` remains in `chat.socket.controller.ts:14`, `socketCatchAsync.ts:5` (L9)                                                                                                                                                   |
| 11  | Middleware ordering                    | ✅     | `app.ts:83-86` routes → 404 → error handler                                         | —                                                                                                                                                                                                                                        |
| 12  | Dead admin registration flow           | ✅     | `admin.service.ts:12-42` creates pre-activated admins                               | —                                                                                                                                                                                                                                        |
| 13  | Dependency hygiene                     | ⚠️     | Bad deps removed, lockfile committed ✅                                             | `stripe` has **0 imports**; `lint-staged` config in `package.json` but no `lint-staged`/husky installed                                                                                                                                  |
| 14  | Security middleware                    | ✅     | `app.ts:24,31-49` helmet, compression, morgan, trust proxy                          | —                                                                                                                                                                                                                                        |
| 15  | Limiter status code                    | ✅     | `limiter.ts:17` → 429                                                               | —                                                                                                                                                                                                                                        |
| 16  | `.env.example` problems                | ✅     | `NODE_ENV`, placeholders, 15m/30d                                                   | —                                                                                                                                                                                                                                        |
| 17  | Weak config validation                 | ✅     | `config/index.ts` zod schema                                                        | —                                                                                                                                                                                                                                        |
| 18  | No request-body validation             | ⚠️     | `validateRequest` + zod exist, but **only the auth module uses them**               | Add small schemas to the other modules (see template 2C)                                                                                                                                                                                 |
| 19  | Upload gaps                            | ✅     | `fileUploader.ts` limits, UUID names, MIME-derived extension; static caching        | —                                                                                                                                                                                                                                        |
| 20  | Data-model scalability                 | ✅     | `Message.chatId` + indexes; refs; 2dsphere                                          | —                                                                                                                                                                                                                                        |
| 21  | No tests / CI                          | ⚠️     | Vitest + Supertest ✅, tests pass. CI workflow removed on purpose (deferred)        | `lint:check` and `prettier:check` still fail: `eslint .` has no config (the old one was deleted as malware); files committed with CRLF (`git ls-files --eol` → `i/crlf`). Fix before re-adding CI — see below.                           |
| 22  | No containerization                    | ➖     | Dockerfile/compose removed on purpose (deferred)                                    | When re-adding Docker, don't copy `docs/openapi.yaml` unless it's restored                                                                                                                                                               |
| 23  | No API docs                            | ⚠️     | Swagger wiring in `app.ts:75-81`                                                    | `docs/openapi.yaml` and the Postman collection are deleted → `/docs` silently disappears                                                                                                                                                 |
| 24  | Inconsistent module style              | ⚠️     | `require` gone, `package.json` metadata fixed ✅                                    | Still mixed `export =` vs `export default` (Notification, AdminNotification, Feedback, Review, limiter)                                                                                                                                  |
| 25  | Docs drift                             | ⚠️     | Old docs deleted; Docker/CI mentions removed from README ✅                         | `README.md:43,161,195,560-571` still reference `openapi.yaml`, `/docs` and 9 deleted files; `README.md` project tree lists a non-existent `eslint.config.mjs`; `src/app/module/admin/summary.md` is a stale migration note inside `src/` |
| 26  | Health & observability                 | ✅     | `/health` with DB state; `X-Request-Id`                                             | —                                                                                                                                                                                                                                        |

**Fix for #21 (make lint/format pass — required before CI is re-added):**

```gitattributes
# .gitattributes
* text=auto eol=lf
```

```bash
git add --renormalize . && git commit -m "chore: normalize line endings to LF"
```

```js
// eslint.config.mjs — minimal, clean replacement
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "node_modules", "logs", "uploads"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
);
```

**Fix for #23 / #25:** pick one — either restore `docs/openapi.yaml` (`git restore docs/openapi.yaml`), or delete the swagger block in `app.ts`, the `swagger-ui-express`/`yaml` deps and the README references. Either way, prune the README's "Further Documentation" table to the files that still exist.

### `template_review_and_improvements.v1.md`

| Item                            | Status | Evidence / follow-up                                                                                                                                                                                                                                     |
| ------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1A Stripe webhook raw body      | ➖     | No Stripe code exists. Remove the unused `stripe` dependency and `STRIPE_SECRET_KEY` config until a payment module is added.                                                                                                                             |
| 1B Cron vs TTL                  | ✅     | Cron kept, but expiry is now enforced in the services, so the cron is only cleanup. Acceptable. (Exception: `resetPassword` still relies on the cron to clear `isVerified` → **H3**.)                                                                    |
| 1C CORS origins                 | ⚠️     | Still hard-coded (`corsOptions.ts:1`), not env-driven. Worse, the prefix checks `startsWith("http://10.10.20.")` / `startsWith("http://3.76.70")` match attacker domains such as `http://10.10.20.evil.com` — and `credentials: true` is set. Fix below. |
| 2A Rate limiting                | ✅     | Login + OTP endpoints limited. `/register` is not → **M2**.                                                                                                                                                                                              |
| 2B Helmet / HPP                 | ✅     | Helmet on. HPP not needed: the simple query parser + `QueryBuilder` drop array values (except `sort`/`fields`, see L2).                                                                                                                                  |
| 2C NoSQL injection in bodies    | ⚠️     | Only auth routes validate bodies. Elsewhere ids go straight into queries: `{"notificationId": {"$ne": null}}` → `findByIdAndDelete` deletes an arbitrary document. Fix: a tiny zod schema per route (also closes v1 #18).                                |
| 3A Env validation with zod      | ✅     | `config/index.ts`.                                                                                                                                                                                                                                       |
| 3B Log stack traces             | ❌     | `globalErrorHandler.ts:61` still logs `error.message`. The `printf` format in `logger.ts:14` also drops the stack from `errorLogger.error("msg", err)` calls in `server.ts`.                                                                             |
| 3C `validateFields` falsy check | ❌     | `validateFields.ts:12` still `if (!payload[field])` → rejects `false` / `0`. (`validateSocketFields` was fixed correctly.)                                                                                                                               |

**Fix for 1C:**

```ts
// corsOptions.ts — exact match against env, no prefix matching
const allowedOrigins = (process.env.CORS_ORIGINS ?? "").split(",").map((o) => o.trim()).filter(Boolean);

origin: (origin, cb) =>
  !origin || allowedOrigins.includes(origin) ? cb(null, true) : cb(new Error("Not allowed by CORS")),
```

Add `CORS_ORIGINS` to the zod schema and `.env.example`; reuse the same list in `connection/socketCors.ts` (currently `origin: "*"`).

**Fix for 2C (example):**

```ts
const objectId = z.string().regex(/^[0-9a-f]{24}$/i, "Invalid id");
const deleteNotification = z.object({ body: z.object({ notificationId: objectId }) });
router.delete("/delete-notification", auth(...), validateRequest(deleteNotification), ...);
```

**Fix for 3B:**

```ts
// globalErrorHandler.ts:61
errorLogger.error(error.stack ?? error.message);
// logger.ts — add format.errors so Error objects keep their stack
format: combine(format.errors({ stack: true }), label(...), timestamp(), myFormat),
// and in myFormat: return `... ${level}: ${info.stack ?? message}`;
```

**Fix for 3C:**

```ts
if (payload[field] === undefined || payload[field] === null || payload[field] === "")
```

---

## 3. New issues

### 🔴 Critical

#### C1. Unawaited promises crash the whole server

`auth.service.ts:104,113,154,324` (emails) · `user.service.ts:49,97` · `admin.service.ts:88,131` · `util/unlinkFile.ts:18-21`

`EmailHelpers.*` catches SMTP errors and **re-throws** an `ApiError`. `unlinkFile` also re-throws. Both are called **without `await`**, so the rejection is unhandled. Since v1 #9, `server.ts:38-41` shuts the process down on `unhandledRejection`.

**Scenarios:**

- SMTP credentials expire or Gmail rate-limits → the next `POST /auth/register` or `/auth/forgot-password` **exits the server**.
- A user's old profile image is missing on disk (wiped `uploads/`, new container) → updating the profile image **exits the server**.

The test file even notes this (`tests/auth.test.ts:4-5`) — it is only mocked away in tests.

**Fix:** await the emails, and make `unlinkFile` best-effort:

```ts
// auth.service.ts (registration): persist first, then await the email
const auth = await Auth.create(authData);
await User.create({ authId: auth._id, name, email });
await EmailHelpers.sendActivationEmail(email, data);
// same: `await` on lines 104, 154, 324
```

```ts
// util/unlinkFile.ts — never throws; callers don't need to care
const unlinkFile = async (filePath: string): Promise<boolean> => {
  try {
    await fs.unlink(filePath);
    return true;
  } catch (error) {
    errorLogger.error(
      `unlinkFile failed for ${filePath}: ${(error as Error).message}`,
    );
    return false;
  }
};
```

#### C2. Mass assignment in user profile update → arbitrary file deletion

`user.service.ts:15`

`const updateData = { ...data }` writes **any** body field to the `User` document. (`deleteFalsyField(data)` on line 20 runs _after_ the spread, so it does nothing.)

**Scenarios:**

- `PATCH /user/edit-profile` with `{"profile_image": ".env"}`, then a second request with a real image → line 49 calls `unlinkFile(".env")` → the server deletes its own `.env` (or `package.json`, `dist/server.js`, …).
- Same with a non-existent path → crash via C1.
- `{"authId": "<other auth id>"}` → `populate("authId")` returns another account's auth record. `{"email": ...}` desyncs `User` from `Auth`.

**Fix:** whitelist fields exactly like `admin.service.ts:53-57` already does, and confine deletions to `uploads/`:

```ts
// user.service.ts
const { name, phoneNumber, address, dateOfBirth } = req.body;
const updateData: Record<string, string> = {
  ...(name && { name }),
  ...(phoneNumber && { phoneNumber }),
  ...(address && { address }),
  ...(dateOfBirth && { dateOfBirth }),
};
```

```ts
// unlinkFile.ts — add before fs.unlink
const root = path.resolve("uploads") + path.sep;
if (!path.resolve(filePath).startsWith(root)) return false;
```

#### C3. Malware persistence leftovers in repo and branches — ✅ FIXED

**What it was:** the malicious `.vscode/tasks.json` (commit `be76e1d`) silently ran `node ./src/app/module/admin/public/fonts/fa-solid-900.woff2` on folder open. The `.vscode/settings.json` from the same commit enabled silent automatic tasks (`"task.allowAutomaticTasks": true`, hidden terminal). After the first cleanup, `settings.json` was still tracked on every branch and `tasks.json` remained on `ts-migration`, `updater` and `backup-main-before-reset`.

**Resolution:**

- `.vscode/` removed and added to `.gitignore` on every branch, pushed to `origin`:

  | Branch                     | Commit    |
  | -------------------------- | --------- |
  | `merger-branch`            | `24cd6fa` |
  | `main`                     | `7a06192` |
  | `original-code-backup`     | `954248e` |
  | `ts-migration`             | `2d00926` |
  | `updater`                  | `c6951b6` |
  | `backup-main-before-reset` | `976e333` |

- All 14 refs (local + `origin`) verified free of `.vscode/` and `.woff2` files.
- VS Code user settings hardened (`task.allowAutomaticTasks: "off"`, Workspace Trust). Machine checked and secrets rotated.

**Residual:** the files still exist in old commits' history. They only matter if someone checks out such a commit directly, and the hardened VS Code settings prevent auto-run. A history rewrite isn't worth it. Note that the old branches don't ignore `.env` — don't commit secrets there.

### 🟠 High

#### H1. Any user can read any chat

`chat.service.ts:70`

`Chat.findOne({ _id: query.chatId })` has no participant check. Any logged-in user with a chat id gets the full message history plus participants' phone numbers.

**Fix:**

```ts
const chat = await Chat.findOne({
  _id: query.chatId,
  participants: userData.userId,
});
```

#### H2. Missing ownership checks (IDOR) in notifications, reviews, feedback

| Location                       | What any logged-in user can do                                                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `notification.service.ts:28`   | Read any notification. Chat notifications contain the message text (`chat.socket.controller.ts:39`), so this also leaks chats. |
| `notification.service.ts:148`  | Delete anyone's notification                                                                                                   |
| `review.service.ts:42, 59, 76` | Read / **edit** / delete anyone's review                                                                                       |
| `feedback.service.ts:75, 141`  | Read / delete anyone's feedback                                                                                                |

**Fix:** add the owner to the filter (admins bypass):

```ts
const isAdmin = [EnumUserRole.ADMIN, EnumUserRole.SUPER_ADMIN].includes(userData.role);
const filter = isAdmin ? { _id: id } : { _id: id, user: userData.userId };   // toId for notifications
await Review.findOneAndUpdate(filter, { $set: updateData }, { ... });
```

#### H3. Password reset is not bound to whoever verified the OTP

`auth.service.ts:327-397`

`forget-pass-otp-verify` sets `isVerified: true` on the account. `reset-password` then accepts **only `email` + new password**. After the real user verifies their OTP, anyone who knows the email can call `/auth/reset-password` first and set the password. The window lasts until the cron clears `isVerified`, and indefinitely if the cron isn't running (the same dependency v1 #4 removed elsewhere).

**Fix (smallest):** make reset require the code again, and drop `isVerified`:

- `forgetPassOtpVerify` only _checks_ the code (no state change).
- `resetPassword({ email, code, newPassword, confirmPassword })` re-runs the same expiry / attempt / match checks, then hashes and `$unset`s the code.

### 🟡 Medium

#### M1. `SUPER_ADMIN` is treated as a regular user

`notification.service.ts:18,20,49,100,138` · `feedback.service.ts:96` · `review.service.ts:17`

These checks use `role === EnumUserRole.ADMIN`. A super admin falls into the user branch: they see no admin notifications, and only their own feedback and reviews.

**Fix:** use one helper everywhere: `const isAdmin = (role) => config.auth_level.admin.includes(role);`

#### M2. `/auth/register` is not rate-limited → email bombing

`auth.routes.ts:16-20`

Re-registering an existing, inactive email resends the OTP email every time (`auth.service.ts:98-105`). A script can flood any inbox from your domain and burn your SMTP quota (which then triggers C1).

**Fix:** add `otpSendLimiter` to `/register`.

#### M3. Tokens survive a password change or reset

`middleware/auth.ts` · `auth.service.ts:399-446`

After a reset (e.g., a compromised account), the attacker's refresh token stays valid for 30 days and keeps minting access tokens.

**Fix:** add `passwordChangedAt: Date` to `Auth`, and set it in `changePassword` and `resetPassword`. Then, in both the auth middleware and `refreshToken`:

```ts
if (
  auth.passwordChangedAt &&
  decoded.iat * 1000 < auth.passwordChangedAt.getTime()
)
  throw new ApiError(
    status.UNAUTHORIZED,
    "Session expired, please log in again",
  );
```

#### M4. Error handler leaks internals and picks wrong status codes

`globalErrorHandler.ts:72,132-137` · `fileUploader.ts:46,80,87`

- Every unknown error returns its raw `error.message` to the client, even in production (Mongo errors, bcrypt `"data and hash arguments required"`, …).
- `TypeError` — almost always a server bug — is reported as **400**. Example: `?sort=a&sort=b` makes `.split` throw a TypeError, and the internal message goes back to the client.
- Multer's "Invalid file type" / "Invalid fieldname" are plain `Error`s → **500** instead of 400.

**Fix:** map `TypeError` → 500. In production, replace the message of non-`ApiError` 5xx responses with `"Something went wrong!"`. In `fileUploader.ts`, throw `new ApiError(status.BAD_REQUEST, "Invalid file type")`.

#### M5. HTML injection in outgoing emails

`mail/signUpEmailTemp.ts:77` (and the other two templates)

The user-supplied `name` is interpolated into the email HTML unescaped. Registering any victim's email with `name = '<a href="https://evil">Verify here</a>'` sends a phishing link **from your domain**.

**Fix:** escape it in `emailHelpers.ts`. `validator` is already a dependency:

```ts
user: validator.escape(data.user);
```

#### M6. Every user's live location is broadcast to all connected clients

`socket.controller.ts:93`

`io.emit(UPDATE_LOCATION, ...)` sends each update to **every** socket. That's a privacy leak, and it is also useless to clients because the payload doesn't say whose location it is.

**Fix:** `socket.emit(...)` (acknowledge to the sender only). Broadcast only to the specific rooms that should see it once that feature exists.

#### M7. `deleteMyAccount` trusts the body instead of the token

`user.service.ts:74-104` · `admin.service.ts:109-138`

The account is looked up by `email` from `req.body`, not by `req.user`. A missing `password` makes `bcrypt.compare(undefined, hash)` throw → 500. Also, `{ "email": { "$ne": null } }` matches the _first_ Auth and the _first_ User, which can be different people (see template 2C).

**Fix:** look up by `req.user.authId` / `req.user.userId`, and require `password` via a zod schema.

#### M8. `POST /review/post-review` is a stub that reports success

`review.service.ts:13` · `review.controller.ts:9-17`

`postReview = async () => {}`, but the controller answers `200 "Review posted"`. Clients believe reviews are saved.

**Fix:** implement it (`Review.create({ user: userId, rating, review })` with a zod schema), or remove the route until needed.

#### M9. Registration can leave a half-created account

`auth.service.ts:113-121`

The activation email is sent **before** `Auth.create`. If `Auth.create` fails, the user got a code for an account that doesn't exist. If `User.create` fails, an `Auth` remains with no `User`: re-registering says "please activate", and activation then sets `isActive: true` and fails with "Account detail not found".

**Fix:** reorder as in C1 (create → create → await email). If `User.create` throws, `await Auth.deleteOne({ _id: auth._id })` before re-throwing.

### 🟢 Low

| #   | Location                                                                          | Problem                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Fix                                                                                                                                                    |
| --- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| L1  | `auth.controller.ts:36-40,53-57` · `auth.routes.ts:28-31`                         | The refresh cookie has no `sameSite`/`maxAge`/`path`, so it dies when the browser closes. `/refresh-token` shares the strict OTP limiter (5 per 15 min per IP), so several users behind one NAT get 429s.                                                                                                                                                                                                                                                             | `{ httpOnly, secure, sameSite: "strict", path: "/auth/refresh-token", maxAge: 30 * 864e5 }`; give refresh its own looser limiter (e.g. 60 per 15 min). |
| L2  | `queryBuilder.ts:82,91,102`                                                       | No upper bound on `limit` (`?limit=1000000` dumps a collection). Array values for `sort`/`fields` throw a TypeError.                                                                                                                                                                                                                                                                                                                                                  | `Math.min(Number(limit) \|\| 10, 100)`; `String(this.query.sort ?? "")`.                                                                               |
| L3  | `sendEmail.ts:4-10,33-34`                                                         | The `date` header is computed once at module load, so every email after day one has a stale date. `signed_by: "bdCalling.com"` is a leftover from another project. A new transporter is created per email.                                                                                                                                                                                                                                                            | Delete `date` and `signed_by`; create the transporter once at module level.                                                                            |
| L4  | `logger.ts:32-35`                                                                 | Plain `transports.File` (`um-success.log`) duplicates the rotating file and grows forever.                                                                                                                                                                                                                                                                                                                                                                            | Remove it; keep the `DailyRotateFile`.                                                                                                                 |
| L5  | `codeGenerator.ts:2`                                                              | OTPs come from `Math.random`, which isn't cryptographically secure.                                                                                                                                                                                                                                                                                                                                                                                                   | `crypto.randomInt(100000, 1000000).toString()`.                                                                                                        |
| L6  | `auth.service.ts:252-255,471-474` · `user.service.ts:89` · `admin.service.ts:123` | `if (auth.password && !match)` fails **open** when the password field is missing (e.g., a future OAuth account or a projection mistake).                                                                                                                                                                                                                                                                                                                              | `if (!auth.password \|\| !(await Auth.isPasswordMatched(...)))`.                                                                                       |
| L7  | various                                                                           | Dead code: `stripe` dep; `processFileUpdates`, `convertToArray`, `dateTimeValidator`, `stripeCurrencyValidator`; `jwtHelpers.createResetToken`; enums `DRIVER`, `EnumPaymentStatus`, `EnumLoginProvider`, `EnumUserAccountStatus`, `START_CHAT`; unused `socket.types.ts`; `activationToken` in `ApiResponse`; cloudinary config with generic `API_KEY`/`API_SECRET` names; commented imports (`user.service.ts:3`, `notification.service.ts:2`); `admin/summary.md`. | Delete. Re-add from git history when a feature actually needs it.                                                                                      |
| L8  | `auth.controller.ts:12-13`                                                        | The HTTP status is chosen by string-matching the service's message, so editing the text silently changes the status.                                                                                                                                                                                                                                                                                                                                                  | Return `{ created: boolean }` (or throw `ApiError` for the existing-account cases).                                                                    |
| L9  | `socket/*` · `socketCatchAsync.ts:11` · `connectDB.ts:7-9`                        | `console.log` + `chalk` instead of the Winston logger, so socket errors never reach the log files. `payload: any` remains.                                                                                                                                                                                                                                                                                                                                            | Use `logger` / `errorLogger`; type the payloads.                                                                                                       |
| L10 | `notification.service.ts:94-129`                                                  | `isRead` isn't validated (`undefined` → empty `$set`). A no-op returns `400 "Already updated"`, but idempotent updates should be 200.                                                                                                                                                                                                                                                                                                                                 | zod `z.boolean()`; return the result without throwing.                                                                                                 |

---

## 4. Fix next (in order)

1. ~~**C3**: malware cleanup.~~ ✅ Done.
2. **C1 + C2 + M9**: await emails, make `unlinkFile` safe and confined to `uploads/`, whitelist profile fields. Same three files; this closes the server-crash and file-deletion vectors.
3. **H1 + H2 + M1**: ownership filters plus a shared `isAdmin` helper.
4. **H3**: require the OTP on `reset-password`.
5. **Make lint/format pass**: `.gitattributes` + renormalize, a minimal `eslint.config.mjs`. Then decide on `openapi.yaml` (restore it, or remove the swagger code/deps and README references). Do this before re-adding CI.
6. **Remaining Medium**: M2 (register limiter), M3 (`passwordChangedAt`), M4 (error handler), M5 (escape email name), M6 (location emit), M7 (delete by token), M8 (review stub). Also template 1C (CORS from env) and 2C / v1 #18 (zod on the remaining routes).
7. **Low items, plus template 3B / 3C**: whenever you're touching those files.
8. **Later**: re-add Docker and CI once steps 2–5 are done.
