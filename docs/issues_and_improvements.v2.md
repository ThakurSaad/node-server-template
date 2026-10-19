# Issues & Improvements — v2

> Full re-review on 2026-10-18 of branch `merger-branch` (working tree incl. uncommitted doc deletions).
> Scope: verify every item from `issues_and_improvements.v1.md` and `template_review_and_improvements.v1.md`, then find new issues.
> Rule of thumb for every fix below: **smallest change that removes the real failure** — no new layers or libraries.
>
> **Updated 2026-10-18:**
>
> - **C3 (malware) is fixed.** `.vscode/` was removed from every branch, local and `origin`, and is now git-ignored. VS Code was hardened and secrets were rotated.
> - **Docker and CI were removed on purpose**, to be added later (`Dockerfile`, `docker-compose.yml`, `.dockerignore`, `.github/workflows/ci.yml`, plus the README sections).
>
> **Updated 2026-10-19: implementation complete.** `docs/implementation_plan.md` (reviewed 85/100) was carried out in full across 15 commits on `fix/v2-issues`. Every open item below — every v1/template follow-up and every C1–L10 finding — is now ✅ fixed; statuses, evidence and the summary counts are updated accordingly. Each row cites the commit that fixed it.

**Toolchain status**

| Check                    | Result        |
| ------------------------ | ------------- |
| `npm run typecheck`      | ✅ passes     |
| `npm test`               | ✅ 53/53 pass |
| `npm run lint:check`     | ✅ 0 problems |
| `npm run prettier:check` | ✅ passes     |

---

## 1. Summary

**v1 verification (35 items):** ✅ 33 fixed · ➖ 2 no longer apply (deferred by choice: Docker, API docs) · ⚠️ 0 partial · ❌ 0 not fixed

**New issues (25):** ✅ 25/25 fixed — 🔴 Critical 3 · 🟠 High 3 · 🟡 Medium 9 · 🟢 Low 10

The migration and the v1 security fixes were already mostly solid. This review's own findings are now closed too:

1. ~~**Malware leftovers** still in the repo/branches.~~ ✅ Cleaned (C3).
2. ~~**Process-crash vector**~~ ✅ Fixed — emails/file deletes/notifications are now awaited or made non-throwing (C1, M9, V1).
3. ~~**Missing ownership checks** (IDOR) in chat, notification, review and feedback modules.~~ ✅ Fixed (H1, H2, M1).
4. ~~**Tooling drift**~~ ✅ Fixed — LF line endings, ESLint flat config, README synced with the code.

See `docs/implementation_plan.md` for the phase-by-phase breakdown and verification steps.

---

## 2. v1 verification

### `issues_and_improvements.v1.md`

| #   | Item                                   | Status | Evidence                                                                                                                                                                                           | Follow-up                                                                                                                                                                     |
| --- | -------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `changePassword` stored plaintext      | ✅     | `auth.service.ts:478-480` hashes via `hashPass`                                                                                                                                                    | —                                                                                                                                                                             |
| 2   | Role escalation on register            | ✅     | `auth.service.ts:83-85` whitelist; `POST /admin/create-admin` + `seed:admin`                                                                                                                       | —                                                                                                                                                                             |
| 3   | Unauthenticated sockets                | ✅     | `socket/socketAuth.ts` JWT in handshake; `socketHandlers.ts:11` uses token `userId`                                                                                                                | Location broadcast leak → **M6**                                                                                                                                              |
| 4   | OTP brute force / expiry               | ✅     | Expiry checked, attempt cap, OTP rate limits; codes now an HMAC-SHA256 hash via `crypto.randomInt` (`323778c`); `/register` added to the shared OTP-send limit (`3780420`)                         | —                                                                                                                                                                             |
| 5   | `isBlocked` + 365d tokens + no refresh | ✅     | `middleware/auth.ts:37-45`; 15m default; `/auth/refresh-token`                                                                                                                                     | Tokens now also revoked on password change/reset via `passwordChangedAt` (`1f5b769`)                                                                                          |
| 6   | NoSQL injection via `QueryBuilder`     | ✅     | `app.ts:28` simple query parser + `queryBuilder.ts:68-72` sanitizer, tested                                                                                                                        | Request bodies now validated too — a zod schema per route (`719f338`)                                                                                                         |
| 7   | `make:file` broken                     | ✅     | `generateModule.ts:54-61` reads argv, targets `src/app/module/<name>`                                                                                                                              | —                                                                                                                                                                             |
| 8   | Cron in service, unawaited             | ✅     | `src/jobs/`, started from `server.ts:60`, `Promise.all` awaited                                                                                                                                    | —                                                                                                                                                                             |
| 9   | No graceful shutdown                   | ✅     | `server.ts:12-49`                                                                                                                                                                                  | Unawaited rejections it would've turned into a crash are now awaited/caught (C1, M9, `d10ef56`)                                                                               |
| 10  | Socket null deref                      | ✅     | `socket.controller.ts:60,88` null checks, typed payloads                                                                                                                                           | The remaining `payload: any` in `chat.socket.controller.ts`/`socketCatchAsync.ts` is now typed/generic (`8da68a4`)                                                            |
| 11  | Middleware ordering                    | ✅     | `app.ts:83-86` routes → 404 → error handler                                                                                                                                                        | —                                                                                                                                                                             |
| 12  | Dead admin registration flow           | ✅     | `admin.service.ts:12-42` creates pre-activated admins                                                                                                                                              | —                                                                                                                                                                             |
| 13  | Dependency hygiene                     | ✅     | Bad deps removed, lockfile committed; `stripe`/`chalk`/`swagger-ui-express`/`yaml` uninstalled and the unused `lint-staged` config dropped (`ea1b80c`)                                             | —                                                                                                                                                                             |
| 14  | Security middleware                    | ✅     | `app.ts:24,31-49` helmet, compression, morgan, trust proxy                                                                                                                                         | —                                                                                                                                                                             |
| 15  | Limiter status code                    | ✅     | `limiter.ts:17` → 429                                                                                                                                                                              | —                                                                                                                                                                             |
| 16  | `.env.example` problems                | ✅     | `NODE_ENV`, placeholders, 15m/30d                                                                                                                                                                  | —                                                                                                                                                                             |
| 17  | Weak config validation                 | ✅     | `config/index.ts` zod schema                                                                                                                                                                       | —                                                                                                                                                                             |
| 18  | No request-body validation             | ✅     | Every module now has a `<module>.validation.ts`, wired through `validateRequest` (`719f338`)                                                                                                       | —                                                                                                                                                                             |
| 19  | Upload gaps                            | ✅     | `fileUploader.ts` limits, UUID names, MIME-derived extension; static caching                                                                                                                       | —                                                                                                                                                                             |
| 20  | Data-model scalability                 | ✅     | `Message.chatId` + indexes; refs; 2dsphere                                                                                                                                                         | —                                                                                                                                                                             |
| 21  | No tests / CI                          | ✅     | Vitest + Supertest ✅, 53 tests pass. CI workflow removed on purpose (deferred, see v1 #22-style scope note)                                                                                       | LF normalized (`24d9354`) and `eslint.config.mjs` added (`f0b0ca4`); `lint:check`/`prettier:check` both pass now, so CI can be re-added cleanly whenever Docker/CI come back. |
| 22  | No containerization                    | ➖     | Dockerfile/compose removed on purpose (deferred)                                                                                                                                                   | When re-adding Docker, don't copy `docs/openapi.yaml` — it was removed (#23) and never restored                                                                               |
| 23  | No API docs                            | ➖     | Swagger/`openapi.yaml` wiring removed rather than restored (decision D2, `ea1b80c`)                                                                                                                | Deliberately deferred, same as Docker — add a docs tool back when there's a spec worth serving                                                                                |
| 24  | Inconsistent module style              | ✅     | `require` gone, `package.json` metadata fixed; every single-value module now uses `export =` (`9e4e14c`)                                                                                           | —                                                                                                                                                                             |
| 25  | Docs drift                             | ✅     | Old docs deleted; `admin/summary.md` removed (`ea1b80c`); README fully synced with the code — no more references to Swagger, Stripe, `DRIVER`, or deleted files (`8da68a4`…`f0b0ca4`, README pass) | —                                                                                                                                                                             |
| 26  | Health & observability                 | ✅     | `/health` with DB state; `X-Request-Id`                                                                                                                                                            | —                                                                                                                                                                             |

**#21 — done.** `.gitattributes` (`* text=auto eol=lf`) plus a full re-checkout normalized every file to LF (`24d9354`), and `eslint.config.mjs` (typescript-eslint recommended) now reports 0 problems (`f0b0ca4`).

**#23 / #25 — done.** Went with removing the Swagger wiring (D2) rather than restoring `openapi.yaml`: the swagger block, `swagger-ui-express`/`yaml` deps and all README references are gone (`ea1b80c`), and the "Further Documentation" table is pruned to the four docs that still exist (README pass).

### `template_review_and_improvements.v1.md`

| Item                            | Status | Evidence / follow-up                                                                                                                                                                                             |
| ------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1A Stripe webhook raw body      | ✅     | No Stripe code exists. The unused `stripe` dependency and `STRIPE_SECRET_KEY` config are removed (`ea1b80c`) — add both back if a payment module is ever built.                                                  |
| 1B Cron vs TTL                  | ✅     | Cron kept, but expiry is now enforced in the services, so the cron is only cleanup. `resetPassword` no longer relies on the cron or an `isVerified` flag at all — it re-checks the OTP directly (H3, `323778c`). |
| 1C CORS origins                 | ✅     | Now env-driven (`CORS_ORIGINS`) with exact matching only — no more prefix checks that matched attacker domains, and `credentials: true` is still scoped to the allow-list (`589f889`).                           |
| 2A Rate limiting                | ✅     | Login + OTP endpoints limited; `/register` now shares the OTP-send budget too (M2, `3780420`).                                                                                                                   |
| 2B Helmet / HPP                 | ✅     | Helmet on. HPP not needed: the simple query parser + `QueryBuilder` drop array values (except `sort`/`fields`, see L2).                                                                                          |
| 2C NoSQL injection in bodies    | ✅     | Every route now validates its body/query with a zod schema (`719f338`) — ids are checked against a 24-hex-char pattern before reaching a filter.                                                                 |
| 3A Env validation with zod      | ✅     | `config/index.ts`.                                                                                                                                                                                               |
| 3B Log stack traces             | ✅     | `globalErrorHandler.ts` now logs the full stack for 5xx errors; `logger.ts`'s `myFormat` appends `info.stack` when winston sets it (`0a3fdb2`).                                                                  |
| 3C `validateFields` falsy check | ✅     | `validateFields.ts` now accepts `false`/`0`, rejecting only `undefined`/`null`/blank strings, matching `validateSocketFields` (`b572bfc`).                                                                       |

**1C, 2C, 3B and 3C are all fixed** — see `docs/implementation_plan.md` phases 4b, 2b and 4a/4c for the exact diffs (`589f889`, `719f338`, `0a3fdb2`, `b572bfc`).

---

## 3. New issues

### 🔴 Critical

#### C1. Unawaited promises crash the whole server — ✅ FIXED (`d10ef56`)

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

#### C2. Mass assignment in user profile update → arbitrary file deletion — ✅ FIXED (`d10ef56`)

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

#### H1. Any user can read any chat — ✅ FIXED (`045cc5d`)

`chat.service.ts:70`

`Chat.findOne({ _id: query.chatId })` has no participant check. Any logged-in user with a chat id gets the full message history plus participants' phone numbers.

**Fix:**

```ts
const chat = await Chat.findOne({
  _id: query.chatId,
  participants: userData.userId,
});
```

#### H2. Missing ownership checks (IDOR) in notifications, reviews, feedback — ✅ FIXED (`045cc5d`)

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

#### H3. Password reset is not bound to whoever verified the OTP — ✅ FIXED (`323778c`)

`auth.service.ts:327-397`

`forget-pass-otp-verify` sets `isVerified: true` on the account. `reset-password` then accepts **only `email` + new password**. After the real user verifies their OTP, anyone who knows the email can call `/auth/reset-password` first and set the password. The window lasts until the cron clears `isVerified`, and indefinitely if the cron isn't running (the same dependency v1 #4 removed elsewhere).

**Fix (smallest):** make reset require the code again, and drop `isVerified`:

- `forgetPassOtpVerify` only _checks_ the code (no state change).
- `resetPassword({ email, code, newPassword, confirmPassword })` re-runs the same expiry / attempt / match checks, then hashes and `$unset`s the code.

### 🟡 Medium

#### M1. `SUPER_ADMIN` is treated as a regular user — ✅ FIXED (`045cc5d`)

`notification.service.ts:18,20,49,100,138` · `feedback.service.ts:96` · `review.service.ts:17`

These checks use `role === EnumUserRole.ADMIN`. A super admin falls into the user branch: they see no admin notifications, and only their own feedback and reviews.

**Fix:** use one helper everywhere: `const isAdmin = (role) => config.auth_level.admin.includes(role);`

#### M2. `/auth/register` is not rate-limited → email bombing — ✅ FIXED (`3780420`)

`auth.routes.ts:16-20`

Re-registering an existing, inactive email resends the OTP email every time (`auth.service.ts:98-105`). A script can flood any inbox from your domain and burn your SMTP quota (which then triggers C1).

**Fix:** add `otpSendLimiter` to `/register`.

#### M3. Tokens survive a password change or reset — ✅ FIXED (`1f5b769`)

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

#### M4. Error handler leaks internals and picks wrong status codes — ✅ FIXED (`0a3fdb2`)

`globalErrorHandler.ts:72,132-137` · `fileUploader.ts:46,80,87`

- Every unknown error returns its raw `error.message` to the client, even in production (Mongo errors, bcrypt `"data and hash arguments required"`, …).
- `TypeError` — almost always a server bug — is reported as **400**. Example: `?sort=a&sort=b` makes `.split` throw a TypeError, and the internal message goes back to the client.
- Multer's "Invalid file type" / "Invalid fieldname" are plain `Error`s → **500** instead of 400.

**Fix:** map `TypeError` → 500. In production, replace the message of non-`ApiError` 5xx responses with `"Something went wrong!"`. In `fileUploader.ts`, throw `new ApiError(status.BAD_REQUEST, "Invalid file type")`.

#### M5. HTML injection in outgoing emails — ✅ FIXED (`b572bfc`)

`mail/signUpEmailTemp.ts:77` (and the other two templates)

The user-supplied `name` is interpolated into the email HTML unescaped. Registering any victim's email with `name = '<a href="https://evil">Verify here</a>'` sends a phishing link **from your domain**.

**Fix:** escape it in `emailHelpers.ts`. `validator` is already a dependency:

```ts
user: validator.escape(data.user);
```

#### M6. Every user's live location is broadcast to all connected clients — ✅ FIXED (`b572bfc`)

`socket.controller.ts:93`

`io.emit(UPDATE_LOCATION, ...)` sends each update to **every** socket. That's a privacy leak, and it is also useless to clients because the payload doesn't say whose location it is.

**Fix:** `socket.emit(...)` (acknowledge to the sender only). Broadcast only to the specific rooms that should see it once that feature exists.

#### M7. `deleteMyAccount` trusts the body instead of the token — ✅ FIXED (`719f338`)

`user.service.ts:74-104` · `admin.service.ts:109-138`

The account is looked up by `email` from `req.body`, not by `req.user`. A missing `password` makes `bcrypt.compare(undefined, hash)` throw → 500. Also, `{ "email": { "$ne": null } }` matches the _first_ Auth and the _first_ User, which can be different people (see template 2C).

**Fix:** look up by `req.user.authId` / `req.user.userId`, and require `password` via a zod schema.

#### M8. `POST /review/post-review` is a stub that reports success — ✅ FIXED (`719f338`)

`review.service.ts:13` · `review.controller.ts:9-17`

`postReview = async () => {}`, but the controller answers `200 "Review posted"`. Clients believe reviews are saved.

**Fix:** implement it (`Review.create({ user: userId, rating, review })` with a zod schema), or remove the route until needed.

#### M9. Registration can leave a half-created account — ✅ FIXED (`d10ef56`)

`auth.service.ts:113-121`

The activation email is sent **before** `Auth.create`. If `Auth.create` fails, the user got a code for an account that doesn't exist. If `User.create` fails, an `Auth` remains with no `User`: re-registering says "please activate", and activation then sets `isActive: true` and fails with "Account detail not found".

**Fix:** reorder as in C1 (create → create → await email). If `User.create` throws, `await Auth.deleteOne({ _id: auth._id })` before re-throwing.

### 🟢 Low

| #   | Location                                                                          | Problem                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Fix                                                                                                                                                    | Status                 |
| --- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------- |
| L1  | `auth.controller.ts:36-40,53-57` · `auth.routes.ts:28-31`                         | The refresh cookie has no `sameSite`/`maxAge`/`path`, so it dies when the browser closes. `/refresh-token` shares the strict OTP limiter (5 per 15 min per IP), so several users behind one NAT get 429s.                                                                                                                                                                                                                                                             | `{ httpOnly, secure, sameSite: "strict", path: "/auth/refresh-token", maxAge: 30 * 864e5 }`; give refresh its own looser limiter (e.g. 60 per 15 min). | ✅ `1f5b769`           |
| L2  | `queryBuilder.ts:82,91,102`                                                       | No upper bound on `limit` (`?limit=1000000` dumps a collection). Array values for `sort`/`fields` throw a TypeError.                                                                                                                                                                                                                                                                                                                                                  | `Math.min(Number(limit) \|\| 10, 100)`; `String(this.query.sort ?? "")`.                                                                               | ✅ `b572bfc`           |
| L3  | `sendEmail.ts:4-10,33-34`                                                         | The `date` header is computed once at module load, so every email after day one has a stale date. `signed_by: "bdCalling.com"` is a leftover from another project. A new transporter is created per email.                                                                                                                                                                                                                                                            | Delete `date` and `signed_by`; create the transporter once at module level.                                                                            | ✅ `b572bfc`           |
| L4  | `logger.ts:32-35`                                                                 | Plain `transports.File` (`um-success.log`) duplicates the rotating file and grows forever.                                                                                                                                                                                                                                                                                                                                                                            | Remove it; keep the `DailyRotateFile`.                                                                                                                 | ✅ `0a3fdb2`           |
| L5  | `codeGenerator.ts:2`                                                              | OTPs come from `Math.random`, which isn't cryptographically secure.                                                                                                                                                                                                                                                                                                                                                                                                   | `crypto.randomInt(100000, 1000000).toString()`.                                                                                                        | ✅ `323778c`           |
| L6  | `auth.service.ts:252-255,471-474` · `user.service.ts:89` · `admin.service.ts:123` | `if (auth.password && !match)` fails **open** when the password field is missing (e.g., a future OAuth account or a projection mistake).                                                                                                                                                                                                                                                                                                                              | `if (!auth.password \|\| !(await Auth.isPasswordMatched(...)))`.                                                                                       | ✅ `719f338`/`3780420` |
| L7  | various                                                                           | Dead code: `stripe` dep; `processFileUpdates`, `convertToArray`, `dateTimeValidator`, `stripeCurrencyValidator`; `jwtHelpers.createResetToken`; enums `DRIVER`, `EnumPaymentStatus`, `EnumLoginProvider`, `EnumUserAccountStatus`, `START_CHAT`; unused `socket.types.ts`; `activationToken` in `ApiResponse`; cloudinary config with generic `API_KEY`/`API_SECRET` names; commented imports (`user.service.ts:3`, `notification.service.ts:2`); `admin/summary.md`. | Delete. Re-add from git history when a feature actually needs it.                                                                                      | ✅ `ea1b80c`           |
| L8  | `auth.controller.ts:12-13`                                                        | The HTTP status is chosen by string-matching the service's message, so editing the text silently changes the status.                                                                                                                                                                                                                                                                                                                                                  | Return `{ created: boolean }` (or throw `ApiError` for the existing-account cases).                                                                    | ✅ `3780420`           |
| L9  | `socket/*` · `socketCatchAsync.ts:11` · `connectDB.ts:7-9`                        | `console.log` + `chalk` instead of the Winston logger, so socket errors never reach the log files. `payload: any` remains.                                                                                                                                                                                                                                                                                                                                            | Use `logger` / `errorLogger`; type the payloads.                                                                                                       | ✅ `8da68a4`           |
| L10 | `notification.service.ts:94-129`                                                  | `isRead` isn't validated (`undefined` → empty `$set`). A no-op returns `400 "Already updated"`, but idempotent updates should be 200.                                                                                                                                                                                                                                                                                                                                 | zod `z.boolean()`; return the result without throwing.                                                                                                 | ✅ `719f338`           |

### Found during implementation (not in this doc originally)

| ID  | Finding                                                                                                                                                                                                           | Fixed in     |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| V1  | Any logged-in socket user could stop the server: `postNotification` threw _outside_ its try, called unawaited with a client-supplied `message`. `message: 0` passed validation and became an unhandled rejection. | ✅ `d10ef56` |
| V2  | Express 5 leaves `req.body` undefined when no body is sent; `admin.service.ts`'s `data.address` then threw a TypeError.                                                                                           | ✅ `d10ef56` |
| V3  | For admins, `get-notification` ignored `notificationId` and always returned `AdminNotification.findOne({})`.                                                                                                      | ✅ `045cc5d` |
| V4  | `post-feedback` is optional-auth, but the controller threw 401 when `req.user` was missing — anonymous feedback was impossible.                                                                                   | ✅ `719f338` |
| V5  | The socket handshake needed to honour `passwordChangedAt` too, or revoked tokens could still open sockets.                                                                                                        | ✅ `1f5b769` |
| V6  | `chat.service.ts`'s `getChatMessages` had the same unbounded `limit` as L2.                                                                                                                                       | ✅ `b572bfc` |
| V7  | The `make:file` service template imported `status` and the model incorrectly, so generated modules didn't compile; it also emitted `export default` and `any`.                                                    | ✅ `9e4e14c` |
| V8  | `QueryBuilder` also used `export default` — missing from the original #24 list.                                                                                                                                   | ✅ `9e4e14c` |
| V9  | `getMyFeedback` (service + controller) was never routed — dead code.                                                                                                                                              | ✅ `ea1b80c` |
| V10 | `Authorization: Bearer` with no token threw a TypeError in the auth middleware: a 400 with a leaked message, and it would have become a 500 once M4 mapped TypeError to 500.                                      | ✅ `1f5b769` |
| V11 | Cookie-only `POST /auth/refresh-token` was a 400, because `AuthValidation.refreshToken` required a body object and Express 5 leaves `req.body` undefined with none sent.                                          | ✅ `719f338` |

---

## 4. Fix next (in order)

All of this is now done, per `docs/implementation_plan.md` (15 commits on `fix/v2-issues`):

1. ~~**C3**: malware cleanup.~~ ✅ Done.
2. ~~**C1 + C2 + M9**: await emails, make `unlinkFile` safe and confined to `uploads/`, whitelist profile fields.~~ ✅ Done (`d10ef56`).
3. ~~**H1 + H2 + M1**: ownership filters plus a shared `isAdmin` helper.~~ ✅ Done (`045cc5d`).
4. ~~**H3**: require the OTP on `reset-password`.~~ ✅ Done (`323778c`).
5. ~~**Make lint/format pass**~~ ✅ Done (`24d9354`, `f0b0ca4`). Decided to remove the Swagger wiring rather than restore `openapi.yaml` (`ea1b80c`).
6. ~~**Remaining Medium**~~ ✅ Done (`1f5b769`, `3780420`, `0a3fdb2`, `b572bfc`, `719f338`, `589f889`).
7. ~~**Low items, plus template 3B / 3C**~~ ✅ Done (see the Low table and the template table above).
8. **Later**: re-add Docker and CI — still deferred, on purpose.

**Only remaining item:** re-adding Docker and CI when there's a reason to (step 8). Everything else in this document is closed.
