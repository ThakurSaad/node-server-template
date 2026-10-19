# Issues and Improvements — v3

A fresh review of the whole codebase at commit `26bf6fe` (2026-10-19). This is analysis only; no source file was changed.

## Summary

| Severity  | Count  |
| --------- | ------ |
| Critical  | 5      |
| High      | 7      |
| Medium    | 8      |
| Low       | 3      |
| **Total** | **23** |

**Toolchain** (Node 24.4.1):

| Check                    | Result                                         |
| ------------------------ | ---------------------------------------------- |
| `npm run typecheck`      | ✅ Pass, 0 errors (covers `src/` only, see M7) |
| `npm run lint:check`     | ✅ Pass, 0 problems                            |
| `npm run prettier:check` | ✅ Pass                                        |
| `npm test`               | ✅ Pass, 53/53 tests in 4 files (about 10 s)   |

Everything is green, and the suite still passes with all five Critical issues present. No test sends query params to a list endpoint, calls `get-all-chats`, re-registers an inactive email, or opens a socket.

**How findings were verified.** Every issue was checked against the code. Items marked _Reproduced_ were run against the real app with a throwaway Vitest suite kept outside the repo: in-memory MongoDB and supertest for HTTP, and raw Engine.IO frames over `ws` for sockets (`socket.io-client` isn't installed). The fixes proposed for C1–C5, H1 and H2/H3 were exercised the same way. Items marked _Code reading_ were not executed.

**Checked and found sound:**

- zod validation on every route that takes a body or an id, with ids restricted to 24-hex strings
- bcrypt password hashing and OTPs stored as HMACs
- token revocation through `passwordChangedAt`
- the exact-match CORS allow-list
- UUID upload filenames with MIME-derived extensions, and `unlinkFile`'s `uploads/` guard
- hiding 5xx messages in production
- graceful shutdown

## Critical

### C1. Query params can overwrite the ownership filter on list endpoints

**Severity:** Critical · **Location:** [src/builder/queryBuilder.ts:58](../src/builder/queryBuilder.ts#L58), reached from [notification.service.ts:65](../src/app/module/notification/notification.service.ts#L65), [review.service.ts:24](../src/app/module/review/review.service.ts#L24), [feedback.service.ts:84](../src/app/module/feedback/feedback.service.ts#L84)

**Problem:** `filter()` merges every leftover query param into the query with `find(sanitized)`, and Mongoose overwrites keys already in the filter. So the service's `{ toId: userId }` or `{ user: userId }` can be replaced from the URL.

_Reproduced:_ user B calls `GET /notification/get-all-notifications?toId=<A's userId>` and receives A's notifications. Those include the text of every chat message sent to A, because `sendMessage` copies each message into a notification. `?user=<A>` on `get-all-reviews` and `get-all-feedbacks` leaks A's reviews and feedback the same way. The review response also embeds A's whole profile: email, phone, address and live location.

**Fix:** keys the service already set take precedence. Admin queries start from `{}`, so they keep full filtering.

```diff
   filter(): this {
+    const base = this.modelQuery.getFilter();
     ...
-      if (key.startsWith("$") || key.includes(".")) continue;
+      if (key.startsWith("$") || key.includes(".") || key in base) continue;
```

This also protects modules made with `make:file`. Their service template points at `review.service.ts` as the owner-filter pattern to copy ([fileTemplates.ts:165](../src/util/fileTemplates.ts#L165)).

### C2. `get-all-chats` returns chat partners' full profiles, including live location

**Severity:** Critical · **Location:** [src/app/module/chat/chat.service.ts:141-147](../src/app/module/chat/chat.service.ts#L141-L147)

**Problem:** the `$lookup` into `users` has no projection, so each participant comes back as the whole User document: `email`, `phoneNumber`, `address`, `dateOfBirth`, `locationCoordinates` and `authId`. `post-chat` accepts any existing user id, so a stranger can do this to anyone.

_Reproduced:_ a stranger calls `POST /chat/post-chat { receiverId }` and then `GET /chat/get-all-chats`. The response contains the target's email, address, birth date, phone and current GPS coordinates. `updateLocation` deliberately never broadcasts location, but this endpoint hands it out anyway.

**Fix:** return only what a chat list needs. A `$lookup` that combines `localField` with a `pipeline` needs MongoDB 5.0 or later.

```diff
       $lookup: {
         from: "users",
         localField: "participants",
         foreignField: "_id",
+        pipeline: [{ $project: { name: 1, profile_image: 1, isOnline: 1 } }],
         as: "participants",
       },
```

Narrow two related spots the same way:

- The review author populate ([review.service.ts:28](../src/app/module/review/review.service.ts#L28)) selects everything except timestamps; use `select: "name profile_image"`.
- `getChatMessages` ([chat.service.ts:75](../src/app/module/chat/chat.service.ts#L75)) gives `phoneNumber` to anyone who opens a chat. Keep that only if it's intended.

### C3. Re-registering an unactivated email keeps the first registrant's password (account pre-hijacking)

**Severity:** Critical · **Location:** [src/app/module/auth/auth.service.ts:103-110](../src/app/module/auth/auth.service.ts#L103-L110)

**Problem:** when the email belongs to an inactive account, `registrationAccount` sends a new code but keeps the stored password. Whoever registered first chose that password, and nobody has proved they own the mailbox.

_Reproduced:_

1. An attacker registers the victim's email with the attacker's own password and never activates.
2. The victim later registers and gets 400 "Already have an account. Please activate", plus a code in their real inbox.
3. The victim activates (201).
4. The attacker logs in with the attacker's password (200). The victim's own password is rejected (400).

**Fix:** the latest registration replaces the unverified credentials.

```diff
     if (!user.isActive) {
+      user.name = name;
+      user.password = password; // re-hashed by the pre("save") hook
       user.activationCode = hashOtp(activationCode);
```

Checked: setting the password on the loaded document re-hashes it on save, and the old password stops matching. A narrow race remains: an attacker who re-registers inside the victim's 3-minute code window. Closing that fully means asking for the password again at activation.

### C4. Rate limits key on a client-controlled `X-Forwarded-For`

**Severity:** Critical · **Location:** [src/app.ts:19](../src/app.ts#L19)

**Problem:** `trust proxy` is hard-coded to `1`, so `req.ip`, the key for every limiter, is the last `X-Forwarded-For` entry. That's only correct with exactly one proxy in front. When the app runs exposed, as in the README setup on `0.0.0.0:8001`, the client writes that header. Behind two proxies, all users share the outer proxy's IP.

_Reproduced:_ 11 bad logins with a fixed header give ten 400s and then a 429. With a new header value per request, 15 attempts never hit a 429. The OTP send and verify limiters fail the same way. Login also answers 404 "User does not exist" but 400 "Password is incorrect", so the unthrottled endpoint doubles as an account-enumeration oracle. The test suite itself relies on the spoof to dodge the limiters ([tests/auth.test.ts:28-40](../tests/auth.test.ts#L28-L40)).

**Fix:** make the hop count explicit config, defaulting to 0.

```ts
// src/config/index.ts
const envSchema = z.object({
  // ...
  TRUST_PROXY: z.coerce.number().int().min(0).default(0), // proxy hops in front
});
// ...and expose it on config as trust_proxy: env.TRUST_PROXY

// src/app.ts
app.set("trust proxy", config.trust_proxy);
```

Set `TRUST_PROXY=1` in `tests/setup.ts` and add it to `.env.example`. Returning the same 401 for an unknown email and a wrong password also removes the enumeration oracle. Checked: with `trust proxy` at 0, the rotating-header loop gets a 429 on the 11th attempt.

### C5. The 5-attempt OTP cap doesn't hold under parallel requests

**Severity:** Critical · **Location:** [src/app/module/auth/auth.service.ts:184-194](../src/app/module/auth/auth.service.ts#L184-L194) (activation) and [:350-360](../src/app/module/auth/auth.service.ts#L350-L360) (password reset)

**Problem:** the code reads the counter, compares the code, and only then applies `$inc`. Requests in flight together all see the old count.

_Reproduced:_ 40 parallel wrong guesses were sent at one activation code, each with its own `X-Forwarded-For` (C4). 38 were checked against the code ("Code didn't match!") and only 2 were refused; the cap is 5. On `reset-password`, that makes the 6-digit code brute-forceable: request a code, fire a large parallel batch, repeat.

**Fix:** count the attempt atomically before comparing. Make the same change in `checkVerificationCode`.

```ts
const counted = await Auth.updateOne(
  { _id: auth._id, activationAttempts: { $lt: MAX_OTP_ATTEMPTS } },
  { $inc: { activationAttempts: 1 } },
);
if (!counted.modifiedCount) {
  await invalidateActivationCode(email);
  throw new ApiError(
    status.TOO_MANY_REQUESTS,
    "Too many attempts. Get a new activation code",
  );
}
if (auth.activationCode !== hashOtp(activationCode))
  throw new ApiError(status.BAD_REQUEST, "Code didn't match!");
```

Checked: with this guard, 40 parallel attempts admit exactly 5.

## High

### H1. Email addresses are case-sensitive

**Severity:** High · **Location:** [src/app/module/auth/Auth.ts:42-50](../src/app/module/auth/Auth.ts#L42-L50), [auth.validation.ts:3](../src/app/module/auth/auth.validation.ts#L3)

**Problem:** emails are stored and looked up exactly as typed.

_Reproduced:_ after registering and activating `Mixed.Case@Example.com`, logging in as `mixed.case@example.com` returns 404 "User does not exist". Registering the lowercase form succeeds and creates a second account for the same mailbox.

**Fix:** add `lowercase: true, trim: true` to `Auth.email`; Mongoose applies it to query filters too (checked). Also normalize at the edge, so the `User` and `Admin` copies match. Use `z.string().trim().toLowerCase().email(...)` in [auth.validation.ts:3](../src/app/module/auth/auth.validation.ts#L3), [admin.validation.ts:22](../src/app/module/admin/admin.validation.ts#L22) and [feedback.validation.ts:5](../src/app/module/feedback/feedback.validation.ts#L5). Existing mixed-case rows need a one-time lowercase; check for duplicates first.

### H2. Socket listeners are attached after two DB round-trips

**Severity:** High · **Location:** [src/socket/socketHandlers.ts:13-33](../src/socket/socketHandlers.ts#L13-L33)

**Problem:** the connection handler awaits `validateUser` (line 13) and `updateOnlineStatus` (line 20) before it registers any listener (lines 25-33). Socket.IO drops events that have no listener.

_Reproduced:_

- A `send_message` emitted as soon as the connection is acknowledged is lost, and no Message is saved. The same emit 500 ms later is saved.
- If the connection drops abruptly in that window, as when a phone loses signal, the `disconnect` is missed. `isOnline` then stays `true` with zero sockets (3 runs out of 3).

**Fix:** move the profile check into `socketAuth`, which already runs before `connection`:

```ts
if (!(await User.exists({ _id: user.userId })))
  return next(new Error("User not found"));
```

Then register the listeners synchronously, and make sure the "online" write can't land after the "offline" one. Call it as `socketHandlers(socket, io)`.

```ts
const socketHandlers = (socket: Socket, io: Server) => {
  const { userId } = socket.data.user as AuthUserPayload;
  socket.join(userId);
  const markedOnline = SocketController.updateOnlineStatus(socket, io, {
    userId,
    isOnline: true,
  });

  socket.on(EnumSocketEvent.UPDATE_LOCATION, (payload) =>
    SocketController.updateLocation(socket, io, { ...payload, userId }),
  );
  socket.on(EnumSocketEvent.SEND_MESSAGE, (payload) =>
    ChatSocketController.sendMessage(socket, io, { ...payload, userId }),
  );
  socket.on(EnumSocketEvent.DISCONNECT, async () => {
    await markedOnline;
    // another tab or device of this user is still connected (H3)
    if (io.sockets.adapter.rooms.get(userId)?.size) return;
    await SocketController.updateOnlineStatus(socket, io, {
      userId,
      isOnline: false,
    });
  });
};
```

Checked against the same scenarios on a scratch server. The early message is saved and abrupt disconnects end offline (3 of 3). Admin tokens are refused at the handshake instead of being connected and then dropped.

### H3. Presence is tracked per socket, not per user

**Severity:** High · **Location:** [src/socket/socketHandlers.ts:33-37](../src/socket/socketHandlers.ts#L33-L37), [src/server.ts:53](../src/server.ts#L53)

**Problem:** every disconnect writes `isOnline: false`, even while the user has other sockets open. And only socket events ever write `isOnline`, so after a crash or redeploy everyone who was connected stays "online".

_Reproduced:_ with two connections open, closing one sets `isOnline: false` while the other is still connected.

**Fix:** add the room-size check from the H2 snippet. Checked: closing one of two sockets keeps the user online, and closing both sets them offline. At boot, add `await User.updateMany({ isOnline: true }, { isOnline: false });` after `connectDB()` in `main()`. That's safe on a single instance, where no socket survives a restart.

### H4. Activation endpoints work on accounts that are already active

**Severity:** High · **Location:** [src/app/module/auth/auth.service.ts:138-164](../src/app/module/auth/auth.service.ts#L138-L164), [:166-245](../src/app/module/auth/auth.service.ts#L166-L245)

**Problem:** neither `resendActivationCode` nor `activateAccount` checks `isActive`. On an active account the pair turns into a login by emailed code: it returns a fresh access token and a 30-day refresh token without the password. Unlike a reset, it changes nothing the owner would notice.

_Reproduced:_ on an active account, `activation-code-resend` returns 200, and `activate-account` with the emailed code returns 201 with tokens. Active users also get "New Activation Code" emails whenever someone requests one. This is High rather than Critical because it requires access to the inbox.

**Fix:**

```ts
// resendActivationCode, after the existence check
if (user.isActive)
  throw new ApiError(status.BAD_REQUEST, "Account is already active");

// activateAccount, after the existence check
if (auth.isActive)
  throw new ApiError(status.BAD_REQUEST, "Account is already active");
```

### H5. User-only routes accept admin tokens and half-apply changes

**Severity:** High · **Location:** [user.routes.ts:12, 15, 22](../src/app/module/user/user.routes.ts#L12), [user.service.ts:29-46](../src/app/module/user/user.service.ts#L29-L46), [feedback.routes.ts:13](../src/app/module/feedback/feedback.routes.ts#L13), [feedback.service.ts:33](../src/app/module/feedback/feedback.service.ts#L33)

**Problem:** `config.auth_level.user` admits ADMIN and SUPER_ADMIN, but these handlers look the caller up in `User`. An admin's `userId` is an `Admin` id, so the lookup finds nothing.

_Reproduced:_

- An admin's `PATCH /user/edit-profile { name }` returns 404 "User not found!". The parallel `Auth` update has already been applied, so `Auth.name` and `Admin.name` now differ.
- A logged-in admin's `POST /feedback/post-feedback` returns 400 "Path `email` is required., Path `name` is required."

By code reading, `/user/profile` and `/user/delete-account` return 404 for admins.

**Fix:** gate these routes on the role they serve: `auth([EnumUserRole.USER])` on the three `/user` routes, and `auth([EnumUserRole.USER], false)` on `post-feedback`. Admins then get a clear 403 instead of a partial write.

### H6. Senders are notified of their own messages

**Severity:** High · **Location:** [src/socket/chat.socket.controller.ts:47](../src/socket/chat.socket.controller.ts#L47), [src/app/module/chat/chat.service.ts:39-48](../src/app/module/chat/chat.service.ts#L39-L48)

**Problem:** `sendMessage` posts "New message" to the sender as well as the receiver. `postChat` tells both sides "You have started a new conversation", which is wrong for the receiver.

_Reproduced:_ after A sends a message, A's own notifications contain it. Every message writes two notifications.

**Fix:** delete line 47, and delete the sender's call at chat.service.ts:44-48. Reword the receiver's text, for example "<name> started a conversation with you".

### H7. Starting a chat with yourself returns someone else's chat

**Severity:** High · **Location:** [src/app/module/chat/chat.service.ts:14-23](../src/app/module/chat/chat.service.ts#L14-L23), [src/socket/chat.socket.controller.ts:25-28](../src/socket/chat.socket.controller.ts#L25-L28)

**Problem:** when `receiverId === userId`, the query `participants: { $all: [userId, receiverId] }` matches any chat the user is in.

_Reproduced:_ A, who has a chat with B, calls `post-chat` with their own id and gets the A–B chat back. A user with no chats gets a new `[A, A]` chat.

_Code reading:_ `sendMessage` with `receiverId` set to the sender stores the message in one of the sender's chats, addressed to the sender, so the other participant never sees it.

**Fix:** add `if (receiverId === userId) throw new ApiError(status.BAD_REQUEST, "You cannot chat with yourself");` to `postChat`, and the same check through `emitError` in `sendMessage`.

## Medium

### M1. Anonymous `post-feedback` has no rate limit

**Severity:** Medium · **Location:** [src/app/module/feedback/feedback.routes.ts:11-16](../src/app/module/feedback/feedback.routes.ts#L11-L16)

**Problem:** this is the only public endpoint that writes to the database without a limiter. Each call creates a `Feedback` and an `AdminNotification`.

_Code reading:_ an unauthenticated loop fills both collections and buries the admin inbox. It's rated Medium because it enables abuse without exposing data.

**Fix:** put `createLimiter({ windowMs: 15 * 60 * 1000, limit: 5 })` in front of `auth(...)`. It takes effect once C4 is fixed.

### M2. Lookups that run on every login and refresh have no index

**Severity:** Medium · **Location:** [User.ts:6](../src/app/module/user/User.ts#L6) and [Admin.ts:6](../src/app/module/admin/Admin.ts#L6) (`authId`); [Review.ts:13](../src/app/module/review/Review.ts#L13) and [Feedback.ts:15](../src/app/module/feedback/Feedback.ts#L15) (`user`)

**Problem:** `User/Admin.findOne({ authId })` runs on every login, token refresh and activation ([auth.service.ts:215-218, 272-275, 432-435](../src/app/module/auth/auth.service.ts#L215)). The per-user review and feedback lists filter on `user`. None of these fields is indexed.

_Code reading:_ every token refresh scans the whole `users` collection, so its cost grows with the number of users.

**Fix:** set `authId: { ..., unique: true }` on `User` and `Admin`, which also enforces one profile per account. Add `index({ user: 1, createdAt: -1 })` to the Review and Feedback schemas.

### M3. `createAdmin` and the seed script can leave an Auth without a profile

**Severity:** Medium · **Location:** [src/app/module/admin/admin.service.ts:23-35](../src/app/module/admin/admin.service.ts#L23-L35), [src/scripts/seedSuperAdmin.ts:28-40](../src/scripts/seedSuperAdmin.ts#L28-L40)

**Problem:** both create the `Auth` and then the `Admin` with no rollback. `registrationAccount` does roll back ([auth.service.ts:121-127](../src/app/module/auth/auth.service.ts#L121-L127)).

_Code reading:_ if `Admin.create` fails, retrying returns 409, or "Super admin already exists" from the seed script. Login fails with 404 "Account detail not found", and only manual DB cleanup recovers the account.

**Fix:** wrap `Admin.create` the way register does: on error, run `await Auth.deleteOne({ _id: auth._id })` and rethrow.

### M4. Token lifetimes without a unit silently mean milliseconds

**Severity:** Medium · **Location:** [src/config/index.ts:22, 26](../src/config/index.ts#L22)

**Problem:** env values are strings, and jsonwebtoken reads a string with no unit as milliseconds.

_Reproduced:_ `JWT_EXPIRES_IN=3600` passes config validation and produces tokens that live 3 seconds. Every request then fails with 401 a few seconds after login. `JWT_REFRESH_EXPIRES_IN` and the refresh cookie behave the same way.

**Fix:**

```ts
const duration = z
  .string()
  .regex(/^\d+[smhdwy]$/, "use a unit, e.g. 15m or 30d");

const envSchema = z.object({
  // ...
  JWT_EXPIRES_IN: duration.default("15m"),
  JWT_REFRESH_EXPIRES_IN: duration.default("30d"),
});
```

### M5. Errors without a dedicated handler get a mismatched error envelope

**Severity:** Medium · **Location:** [src/app/middleware/globalErrorHandler.ts:58-69](../src/app/middleware/globalErrorHandler.ts#L58-L69)

**Problem:** `errorMessages` is built from the default text before the error's own message is read.

_Reproduced:_ a malformed JSON body returns 400 with `message: "Unexpected end of JSON input"` but `errorMessages: [{ message: "Something went wrong!" }]`. Body-parser's 413 and every other error without a dedicated handler get the same mismatch.

**Fix:** build it after the extraction block. Declare `let errorMessages = createErrorMessage(message);` below line 69 instead of at line 60.

### M6. `SERVICE_NAME` is ignored, and leftover config is unused

**Severity:** Medium · **Location:** [signUpEmailTemp.ts:74-85](../src/mail/signUpEmailTemp.ts#L74-L85), [otpResendTemp.ts:76-95](../src/mail/otpResendTemp.ts#L76-L95), [resetPassEmailTemp.ts:75-96](../src/mail/resetPassEmailTemp.ts#L75-L96), [logger.ts:32, 49](../src/util/logger.ts#L32), [app.ts:53](../src/app.ts#L53), [feedback.service.ts:62](../src/app/module/feedback/feedback.service.ts#L62), [config/index.ts:51-55, 96-99, 105-108](../src/config/index.ts#L51-L55)

**Problem:** `SERVICE_NAME` is documented as the product name in emails, but it only reaches the From header.

- "Mount Fuji" is hard-coded in 12 places.
- The email templates read `process.env.EMAIL_TEMP_IMAGE` directly instead of going through `config`.
- `CLOUD_NAME`, `CLOUDINARY_URL`, `EMAIL_TEMP_TEXT_SECONDARY_COLOR`, `config.cloudinary` and `config.variables` are never read.

_Code reading:_ a project that sets `SERVICE_NAME=Acme` still sends "Welcome to Mount Fuji" activation emails.

**Fix:** use `config.smtp.NAME` and `config.variables.email_temp_image` in those places, and delete the unused keys from the schema and the config object.

### M7. Type checking is weaker than the config suggests

**Severity:** Medium · **Location:** [tsconfig.json:13, 20](../tsconfig.json#L13)

**Problem:** `"strictNullChecks": false` turns off the null-safety part of `"strict": true`. Separately, `include: ["src/**/*"]` keeps `tests/` out of `npm run typecheck`, and Vitest doesn't type-check either.

_Reproduced:_ enabling `strictNullChecks` reports 9 errors. Most are callback typings, but [user.service.ts:10](../src/app/module/user/user.service.ts#L10) destructures `req.user` without the guard every other handler has. `tests/` type-checks cleanly today (checked with a scratch config), so that half is preventive.

**Fix:**

- Delete line 13 and fix the 9 errors: fileUploader.ts:36 and 52, globalErrorHandler.ts:73, notification.service.ts:20 and 112, review.service.ts:63-64, user.service.ts:10.
- Add a `tests/tsconfig.json` that extends the root config with `"rootDir": ".."` and `include: ["../src/**/*", "**/*"]`.
- Append `&& tsc -p tests --noEmit` to the `typecheck` script.

### M8. The module generator's output fails the project's own checks

**Severity:** Medium · **Location:** [src/util/generateModule.ts:13-14, 54](../src/util/generateModule.ts#L13-L14), [src/util/fileTemplates.ts](../src/util/fileTemplates.ts)

**Problem:** the templates aren't Prettier-formatted (a leading blank line, an empty `{\n\n  }`), and the module name isn't validated.

_Reproduced in a scratch copy:_

- Generating `Booking` passes tsc and ESLint, but `prettier --check` flags all 4 files, so `npm run prettier:check` fails right after `make:file`.
- Generating `order-item` writes `const order-itemSchema`, which doesn't compile.

**Fix:** reject names that aren't identifiers (`/^[A-Za-z][A-Za-z0-9]*$/`) and print the usage message. Format each file before writing it with `format(content, { parser: "typescript" })` from `prettier` (already a devDependency). This makes `generateModule` async.

## Low

### L1. Cron errors go to the info log

**Severity:** Low · **Location:** [src/jobs/index.ts:18](../src/jobs/index.ts#L18)

**Problem:** the OTP cleanup job logs failures with `logger.error`, which is the info logger. They land in the success log and never reach the error log.

**Fix:** use `errorLogger.error(...)`.

### L2. The upload middleware has misleading and unreachable code

**Severity:** Low · **Location:** [src/app/middleware/fileUploader.ts:9, 77-83, 93, 99](../src/app/middleware/fileUploader.ts#L77-L83)

**Problem:** `MAX_FILE_COUNT = 4` and the "up to 4 image fields" comment describe a setup that accepts a single `profile_image`. The `!file.fieldname` branch and the `allowedFieldNames` check never run, because multer's `.fields()` rejects other field names (`LIMIT_UNEXPECTED_FILE`) before `fileFilter` is called. _Checked:_ uploading a file as `avatar` returns multer's message, not "Invalid fieldname".

**Fix:** remove the dead branch and the duplicate whitelist, set `files: 1`, and fix the comment.

### L3. Dead code and stale text

**Severity:** Low · **Locations and fixes:**

- [notification.service.ts:58, 79](../src/app/module/notification/notification.service.ts#L58): `if (!notifications)` can never be true, because `find` returns an array. Delete it.
- [socket.controller.ts:35, 42](../src/socket/socket.controller.ts#L35): `return null` after `emitError`, which is typed `never` and always throws. Delete it.
- [connection/socket.ts:18](../src/connection/socket.ts#L18): `socketHandlers(socket, io, {})` passes a dummy payload only because of the `socketCatchAsync` wrapper. It goes away with H2.
- [auth.service.ts:272, 275](../src/app/module/auth/auth.service.ts#L272): login populates `authId` but uses only `result._id`. Dropping `.populate("authId")` saves a query per login.
- [emitError.ts:9](../src/socket/emitError.ts#L9): the client-facing message has a typo, "Internal sever error".
- [tests/auth.test.ts:4-5](../tests/auth.test.ts#L4-L5): the comment says services fire emails without awaiting them, but they do await them (auth.service.ts:109, 129, 163, 333).

## Fix next

1. **C1:** add one condition to `QueryBuilder.filter()`. This closes three cross-user leaks and also protects generated modules.
2. **C2:** project participant fields in `getAllChats`, and narrow the review author populate.
3. **C3:** overwrite name and password when an inactive email re-registers.
4. **C4 + C5:** add `TRUST_PROXY` (default 0, set to 1 in `tests/setup.ts`) and the atomic OTP attempt guard. Together they restore brute-force protection.
5. Add a regression test with each Critical fix. All 53 current tests pass while every Critical issue is present.
6. **H1:** lowercase emails in the schema and in zod, and migrate existing rows.
7. **H2 + H3:** rewrite `socketHandlers` as shown, and reset `isOnline` at boot.
8. **H4 to H7:** add four small guards.
9. **M1, M4, M2:** cheap protection against spam, a config footgun and slow logins. Then work through the remaining Medium and Low items.
