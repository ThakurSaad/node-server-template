# API Reference

Complete reference for the Server Setup Template REST API and WebSocket interface.

## Contents

| Guide                                 | Covers                                                                  |
| ------------------------------------- | ----------------------------------------------------------------------- |
| [Authentication](./authentication.md) | Registration, OTP activation, login, token refresh, password management |
| [Profiles](./profiles.md)             | User & admin profile management, admin creation                         |
| [Chat](./chat.md)                     | 1-to-1 conversations, message history, read receipts, WebSocket events  |
| [Notifications](./notifications.md)   | In-app notification retrieval and management                            |
| [Reviews](./reviews.md)               | Review CRUD                                                             |
| [Feedback](./feedback.md)             | Feedback submission and admin replies                                   |
| [Content (CMS)](./content.md)         | Terms & conditions, privacy policy, about us, FAQ, contact us           |

An OpenAPI 3 spec lives at [`../openapi.yaml`](../openapi.yaml) and is served as Swagger UI at `/docs` in non-production environments. A ready-to-import Postman collection is provided at [`postman_collection.json`](./postman_collection.json).

---

## Base URL

```
http://localhost:8001
```

All examples in this reference use the local development URL. Substitute your deployed host. There is no path-based versioning; routes are mounted at the root.

## Authentication

The API uses **JWT bearer tokens**. Obtain a token pair from [`POST /auth/login`](./authentication.md#login) (or account activation), then send the access token on every protected request:

```
Authorization: Bearer <accessToken>
```

- **Access tokens** are short-lived (default **15 minutes**). When one expires, exchange your refresh token at [`POST /auth/refresh-token`](./authentication.md#refresh-token) — don't re-login.
- **Refresh tokens** live longer (default **30 days**) and are also set as an `httpOnly` cookie on login/activation, so browser clients can refresh without storing the token in JavaScript.
- On every protected request the server re-verifies that the account still exists, is activated, and is **not blocked** — revoking access takes effect immediately, not at next login.

### Roles

| Role          | Description                                                       |
| ------------- | ----------------------------------------------------------------- |
| `USER`        | Standard account. The only role that can self-register.           |
| `DRIVER`      | Reserved for driver-style profiles (template extension point).    |
| `ADMIN`       | Elevated access. Created by a SUPER_ADMIN, never self-registered. |
| `SUPER_ADMIN` | Root role. Created once via `npm run seed:admin`.                 |

Endpoints marked 🔒 **user** accept `USER`, `ADMIN`, and `SUPER_ADMIN`; 🔒 **admin** accepts `ADMIN` and `SUPER_ADMIN`; 🔒 **super admin** accepts `SUPER_ADMIN` only.

## Response envelope

Every response — success or failure — uses one predictable JSON shape.

**Success**

```json
{
  "statusCode": 200,
  "success": true,
  "message": "Reviews retrieved",
  "meta": { "page": 1, "limit": 10, "total": 42, "totalPage": 5 },
  "data": { "...": "..." }
}
```

| Field        | Type    | Notes                                          |
| ------------ | ------- | ---------------------------------------------- |
| `statusCode` | integer | Mirrors the HTTP status                        |
| `success`    | boolean | `true` on 2xx                                  |
| `message`    | string  | Human-readable summary                         |
| `meta`       | object  | Present on paginated list endpoints only       |
| `data`       | any     | The resource; omitted when there is no payload |

**Error**

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation error",
  "errorMessages": [
    { "path": "email", "message": "Please provide a valid email address" }
  ]
}
```

`errorMessages` always contains at least one `{ path, message }` entry; for validation failures there is one entry per invalid field. A `stack` field is included in non-production environments only.

## HTTP status codes

| Code  | Meaning                                                                  |
| ----- | ------------------------------------------------------------------------ |
| `200` | Request succeeded                                                        |
| `201` | Resource created (activation, admin creation)                            |
| `400` | Malformed request — validation failure, wrong password, wrong OTP        |
| `401` | Missing/invalid/expired token, or invalid refresh token                  |
| `403` | Authenticated but not allowed — wrong role, blocked, or inactive account |
| `404` | Resource does not exist                                                  |
| `409` | Conflict — duplicate unique value (e.g. email already registered)        |
| `413` | Uploaded file exceeds the 5 MB limit                                     |
| `429` | Rate limit exceeded — retry after the window resets                      |
| `500` | Unexpected server error                                                  |

## Pagination, filtering, sorting

List endpoints share a common query interface powered by the query builder:

| Parameter    | Type    | Default      | Description                                                           |
| ------------ | ------- | ------------ | --------------------------------------------------------------------- |
| `page`       | integer | `1`          | Page number (1-indexed)                                               |
| `limit`      | integer | `10`         | Items per page                                                        |
| `sort`       | string  | `-createdAt` | Comma-separated fields; prefix `-` for descending (`-createdAt,name`) |
| `fields`     | string  | all          | Comma-separated projection (`name,email`)                             |
| `searchTerm` | string  | —            | Case-insensitive substring match across the endpoint's search fields  |
| `<field>`    | string  | —            | Any other parameter becomes an exact-match filter (`?isRead=false`)   |

Paginated responses include the `meta` object (`page`, `limit`, `total`, `totalPage`).

Filter values are sanitized server-side: only plain string values are accepted, and Mongo operator syntax (`?age[$ne]=0`) is stripped, never executed.

## Rate limits

Rate limits are keyed per client IP and return **HTTP 429** with the standard error envelope when exceeded. Standard `RateLimit-*` headers (IETF draft 8) are included on limited endpoints.

| Endpoints                                                                                                               | Limit          |
| ----------------------------------------------------------------------------------------------------------------------- | -------------- |
| `POST /auth/login`                                                                                                      | 10 / hour      |
| OTP **send**: `/auth/activation-code-resend`, `/auth/forgot-password`                                                   | 3 / 15 minutes |
| OTP **verify**: `/auth/activate-account`, `/auth/forget-pass-otp-verify`, `/auth/reset-password`, `/auth/refresh-token` | 5 / 15 minutes |
| All other endpoints                                                                                                     | Unlimited      |

Independently of HTTP rate limits, OTP codes themselves expire after **3 minutes** and are invalidated after **5 wrong attempts**.

## Request IDs

Every response carries an `X-Request-Id` header. Include it when reporting an issue — it correlates your request with the server logs.

## System endpoints

| Method | Endpoint  | Description                                                               |
| ------ | --------- | ------------------------------------------------------------------------- |
| GET    | `/`       | Welcome message (liveness probe)                                          |
| GET    | `/health` | `{ status, uptime, db }` — returns `503` when the database is unreachable |
| GET    | `/docs`   | Swagger UI (non-production only)                                          |

```bash
curl http://localhost:8001/health
```

```json
{ "status": "ok", "uptime": 128.4, "db": "up" }
```
