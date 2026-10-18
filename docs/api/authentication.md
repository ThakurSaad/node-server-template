# Authentication

Register accounts, verify them by email OTP, obtain and refresh JWT token pairs, and manage passwords.

**Base path:** `/auth` · See the [conventions guide](./README.md) for the response envelope, error format, and rate limits.

## The authentication lifecycle

```
register ──▶ activate-account ──▶ login ──▶ (access token expires) ──▶ refresh-token
   │                                 │
   └── activation-code-resend        └── change-password (authenticated)

forgot-password ──▶ forget-pass-otp-verify ──▶ reset-password
```

All OTP codes are **6 digits**, expire after **3 minutes**, and are invalidated after **5 wrong attempts**. All endpoints below validate their bodies with zod — invalid input returns `400` with per-field `errorMessages`.

---

## Register

```
POST /auth/register
```

Creates an inactive `USER` account and emails a 6-digit activation code. Only `role: "USER"` is accepted — privileged roles are rejected with `400` (admins are created via [`POST /admin/create-admin`](./profiles.md#create-admin)).

Calling this endpoint again for an existing **inactive** account re-issues the activation code instead of failing; for an already-active account it returns a prompt to log in.

### Body parameters

| Parameter         | Type   | Required | Description                   |
| ----------------- | ------ | -------- | ----------------------------- |
| `name`            | string | Yes      | Display name                  |
| `email`           | string | Yes      | Must be a valid, unused email |
| `role`            | string | Yes      | Must be `"USER"`              |
| `password`        | string | Yes      | Minimum 8 characters          |
| `confirmPassword` | string | Yes      | Must match `password`         |

### Example request

```bash
curl -X POST http://localhost:8001/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Doe",
    "email": "jane@example.com",
    "role": "USER",
    "password": "hunter2-secure",
    "confirmPassword": "hunter2-secure"
  }'
```

### Response `200`

```json
{
  "statusCode": 200,
  "success": true,
  "message": "Account created successfully. Please check your email",
  "data": {
    "isActive": false,
    "message": "Account created successfully. Please check your email"
  }
}
```

### Errors

| Status | Condition                                            |
| ------ | ---------------------------------------------------- |
| `400`  | Validation failure, password mismatch, non-USER role |

---

## Activate account

```
POST /auth/activate-account
```

Verifies the emailed OTP, activates the account, and returns a token pair. The refresh token is also set as an `httpOnly` cookie. **Rate limit:** 5 / 15 min.

### Body parameters

| Parameter        | Type   | Required | Description             |
| ---------------- | ------ | -------- | ----------------------- |
| `email`          | string | Yes      | Account email           |
| `activationCode` | string | Yes      | 6-digit code from email |

### Example request

```bash
curl -X POST http://localhost:8001/auth/activate-account \
  -H "Content-Type: application/json" \
  -d '{ "email": "jane@example.com", "activationCode": "482913" }'
```

### Response `201`

```json
{
  "statusCode": 201,
  "success": true,
  "message": "Activation code verified successfully.",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

### Errors

| Status | Condition                                       |
| ------ | ----------------------------------------------- |
| `400`  | Wrong code, or code expired (request a new one) |
| `404`  | Unknown email, or no pending activation code    |
| `429`  | Too many wrong attempts — code invalidated      |

---

## Resend activation code

```
POST /auth/activation-code-resend
```

Issues a fresh activation OTP and resets the attempt counter. **Rate limit:** 3 / 15 min.

### Body parameters

| Parameter | Type   | Required |
| --------- | ------ | -------- |
| `email`   | string | Yes      |

### Response `200`

```json
{ "statusCode": 200, "success": true, "message": "Resent successfully" }
```

---

## Login

```
POST /auth/login
```

Authenticates with email + password and returns a token pair. The refresh token is also set as an `httpOnly` cookie. **Rate limit:** 10 / hour.

### Body parameters

| Parameter  | Type   | Required |
| ---------- | ------ | -------- |
| `email`    | string | Yes      |
| `password` | string | Yes      |

### Example request

```bash
curl -X POST http://localhost:8001/auth/login \
  -H "Content-Type: application/json" \
  -d '{ "email": "jane@example.com", "password": "hunter2-secure" }'
```

### Response `200`

```json
{
  "statusCode": 200,
  "success": true,
  "message": "Log in successful",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

The decoded access-token payload carries `{ authId, userId, email, role }`.

### Errors

| Status | Condition                                |
| ------ | ---------------------------------------- |
| `400`  | Wrong password, or account not activated |
| `403`  | Account is blocked                       |
| `404`  | No account with this email               |
| `429`  | Rate limited                             |

---

## Refresh token

```
POST /auth/refresh-token
```

Exchanges a valid refresh token for a fresh access token. The token is read from the request body **or** the `refreshToken` cookie set at login — browser clients that rely on the cookie can send an empty body. The account's active/blocked status is re-checked before a new token is issued. **Rate limit:** 5 / 15 min.

### Body parameters

| Parameter      | Type   | Required                     |
| -------------- | ------ | ---------------------------- |
| `refreshToken` | string | If the cookie is not present |

### Example request

```bash
curl -X POST http://localhost:8001/auth/refresh-token \
  -H "Content-Type: application/json" \
  -d '{ "refreshToken": "eyJhbGciOiJIUzI1NiIs..." }'
```

### Response `200`

```json
{
  "statusCode": 200,
  "success": true,
  "message": "Access token refreshed successfully",
  "data": { "accessToken": "eyJhbGciOiJIUzI1NiIs..." }
}
```

### Errors

| Status | Condition                                    |
| ------ | -------------------------------------------- |
| `401`  | Missing, malformed, or expired refresh token |
| `403`  | Account has been blocked or deactivated      |

---

## Forgot password

```
POST /auth/forgot-password
```

Emails a 6-digit password-reset code. **Rate limit:** 3 / 15 min.

### Body parameters

| Parameter | Type   | Required |
| --------- | ------ | -------- |
| `email`   | string | Yes      |

### Response `200`

```json
{ "statusCode": 200, "success": true, "message": "Check your email!" }
```

---

## Verify reset code

```
POST /auth/forget-pass-otp-verify
```

Verifies the reset OTP and unlocks [`/auth/reset-password`](#reset-password) for this account. **Rate limit:** 5 / 15 min.

### Body parameters

| Parameter | Type   | Required | Description             |
| --------- | ------ | -------- | ----------------------- |
| `email`   | string | Yes      |                         |
| `code`    | string | Yes      | 6-digit code from email |

### Response `200`

```json
{ "statusCode": 200, "success": true, "message": "Code verified successfully" }
```

### Errors

| Status | Condition                                      |
| ------ | ---------------------------------------------- |
| `400`  | Wrong code, or code expired                    |
| `404`  | Unknown email, or no pending verification code |
| `429`  | Too many wrong attempts — code invalidated     |

---

## Reset password

```
POST /auth/reset-password
```

Sets a new password after OTP verification. Fails with `403` unless [`/auth/forget-pass-otp-verify`](#verify-reset-code) succeeded first. **Rate limit:** 5 / 15 min.

### Body parameters

| Parameter         | Type   | Required | Description          |
| ----------------- | ------ | -------- | -------------------- |
| `email`           | string | Yes      |                      |
| `newPassword`     | string | Yes      | Minimum 8 characters |
| `confirmPassword` | string | Yes      | Must match           |

### Response `200`

```json
{
  "statusCode": 200,
  "success": true,
  "message": "Password has been reset successfully."
}
```

### Errors

| Status | Condition                      |
| ------ | ------------------------------ |
| `400`  | Passwords do not match         |
| `403`  | OTP verification not completed |
| `404`  | Unknown email                  |

---

## Change password

```
PATCH /auth/change-password
```

🔒 **user** — Changes the password for the authenticated account after verifying the old one.

### Body parameters

| Parameter         | Type   | Required | Description          |
| ----------------- | ------ | -------- | -------------------- |
| `oldPassword`     | string | Yes      | Current password     |
| `newPassword`     | string | Yes      | Minimum 8 characters |
| `confirmPassword` | string | Yes      | Must match           |

### Example request

```bash
curl -X PATCH http://localhost:8001/auth/change-password \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "oldPassword": "hunter2-secure",
    "newPassword": "correct-horse-battery",
    "confirmPassword": "correct-horse-battery"
  }'
```

### Response `200`

```json
{
  "statusCode": 200,
  "success": true,
  "message": "Password changed successfully!"
}
```

### Errors

| Status | Condition                           |
| ------ | ----------------------------------- |
| `400`  | Old password wrong, or new mismatch |
| `401`  | Missing or invalid access token     |
