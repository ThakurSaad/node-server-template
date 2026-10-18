# Project Technical Documentation

This document is a technical overview of the current project state, intended as foundational context for developers or AI assistants using this repository as a starting template. It reflects the codebase after the 2026-07 security/hardening remediation (see `issues_and_improvements.md` and `implementation_plan.md`).

## 1. High-Level Architecture

A backend RESTful API on **Node.js** + **Express 5**, written in **TypeScript**, using a **Modular Monolith** architecture: business logic is split by domain (`auth`, `user`, `admin`, `chat`, `review`, `feedback`, `notification`, `manage`), and each domain encapsulates its own model, controller, service, and routes.

## 2. Technology Stack

- **Language/Runtime:** TypeScript / Node.js (>= 20)
- **Framework:** Express 5
- **ODM / Database:** Mongoose / MongoDB
- **Authentication:** JWT (short-lived access + refresh tokens), `bcrypt` password hashing
- **Validation:** Zod (environment config + request bodies)
- **Real-time:** Socket.IO 4 (JWT-authenticated handshakes)
- **Email:** Nodemailer (SMTP)
- **Uploads:** Multer (disk storage, 5 MB limit, UUID filenames)
- **Background jobs:** node-cron (started from `server.ts`, stopped on shutdown)
- **Security middleware:** helmet, express-rate-limit, CORS allow-list
- **Logging:** Winston + daily rotation; morgan HTTP logs with request-id correlation
- **Tests:** Vitest + Supertest + mongodb-memory-server; GitHub Actions CI
- **Payments:** Stripe SDK (config pre-wired)

## 3. Directory Structure

```
├── src/
│   ├── app/
│   │   ├── middleware/       # auth (JWT+roles+blocked check), validateRequest (zod),
│   │   │                     # fileUploader, limiter (429), requestId, globalErrorHandler
│   │   ├── module/           # Domain modules (model/controller/service/routes[/validation])
│   │   └── routes/index.ts   # Central router
│   ├── builder/              # QueryBuilder (sanitized search/filter/sort/paginate)
│   ├── config/index.ts       # zod-validated env config (fails fast on boot)
│   ├── connection/           # connectDB, socket (exports mainServer + io), socketCors
│   ├── error/                # ApiError + error transformers (incl. handleZodError)
│   ├── jobs/                 # Cron bootstrap: startJobs()/stopJobs() from server.ts
│   ├── mail/                 # HTML email templates
│   ├── scripts/              # seedSuperAdmin.ts (npm run seed:admin)
│   ├── socket/               # socketAuth (JWT middleware), handlers, controllers
│   ├── types/                # Shared types + Express Request augmentation
│   ├── util/                 # jwtHelpers, logger, httpStatus shim, generateModule, ...
│   ├── app.ts                # Express assembly (helmet → cors → parsers → routes → 404 → errors)
│   └── server.ts             # Entry: connect DB → listen → start jobs; graceful shutdown
├── tests/                    # Vitest suites (auth flows, QueryBuilder)
├── docs/openapi.yaml         # Served at /docs outside production
├── Dockerfile                # Multi-stage build; docker-compose.yml with MongoDB
└── .github/workflows/ci.yml  # typecheck → lint → format → test → build
```

## 4. Core System Workflows

### Authentication and Authorization

Credentials live in the `Auth` collection; profile data lives in `User`/`Admin` linked by `authId`.

- **Registration** (`POST /auth/register`): only `role: USER` is accepted — privileged roles are rejected. A **6-digit OTP** (3-minute expiry) is emailed; the account stays inactive until verified.
- **Activation** (`POST /auth/activate-account`): checks the code **and its expiry**; 5 wrong attempts invalidate the code. Success issues an access token (default 15m) and refresh token (default 30d).
- **Refresh** (`POST /auth/refresh-token`): exchanges the refresh token (body or httpOnly cookie) for a new access token, re-checking `isActive`/`isBlocked`.
- **Admin creation**: admins never self-register. Seed the first SUPER_ADMIN with `npm run seed:admin`, then use `POST /admin/create-admin` (SUPER_ADMIN only) — accounts are created pre-activated.
- The `auth(roles)` middleware verifies the JWT **and** re-checks the account exists, is active, and is not blocked on every request.
- Rate limits: login 10/hour; OTP send endpoints 3/15min; OTP verify endpoints 5/15min (HTTP 429).
- A cron job (started in `server.ts`, defined in `src/jobs/`) prunes expired OTP fields every minute as cleanup — expiry is enforced in the services themselves.

### Request Validation

`validateRequest(schema)` middleware validates `body`/`query`/`params` with zod before controllers run (see `auth.validation.ts`). Zod errors are formatted by `handleZodError` into the standard error envelope. The `QueryBuilder` additionally strips NoSQL operator injection (`?field[$ne]=x`) and escapes regex metacharacters in `searchTerm`; `app.ts` also sets the `simple` query parser.

### Error Handling

All failures funnel to `globalErrorHandler`, which recognizes Mongoose Validation/Cast errors, duplicate keys, Multer, JWT, Zod, and `ApiError`, responding with:

```json
{
  "success": false,
  "message": "Error reason",
  "errorMessages": [{ "path": "field", "message": "detail" }]
}
```

Stack traces are included outside production only. HTTP status codes come from a local `util/httpStatus.ts` shim (the `http-status` package ships ESM-only types).

### Real-time Communication

Socket.IO shares the HTTP port (`src/connection/socket.ts` exports `mainServer` and `io`). Handshakes are authenticated by `socketAuth` middleware: clients connect with `{ auth: { token } }` and the user identity is derived from the JWT — never from client-supplied ids. Handlers cover presence (`isOnline`), live location (GeoJSON + 2dsphere index), and 1-to-1 chat.

### Chat Data Model

Messages are stored in their own collection keyed by `chatId` (indexed `{ chatId, createdAt }`) — `Chat` holds only `participants`. This keeps chat documents bounded and message history queries index-backed.

### Lifecycle

`server.ts` implements graceful shutdown: SIGTERM/SIGINT/fatal errors stop cron jobs, close Socket.IO and HTTP, disconnect Mongoose, then exit (10s hard-kill fallback). `uncaughtException` exits after logging.

## 5. Using as a Template

1. **Module generator**: `npm run make:file -- <ModuleName>` scaffolds model/controller/service/routes under `src/app/module/<name>`; mount the router in `src/app/routes/index.ts`.
2. **Environment**: copy `.env.example` to `.env`. The zod schema in `src/config/index.ts` is the source of truth — the app exits with a clear message if required values are missing. Keep `.env.example` in sync with the schema.
3. **Verification loop**: `npm run typecheck`, `npm run lint:check`, `npm test`. CI runs all three plus a build on every PR.
4. **Local stack**: `docker compose up` starts the API + MongoDB with health checks.
5. **API docs**: `/docs` (Swagger UI from `docs/openapi.yaml`) outside production.
6. **DB conventions**: use `.lean()` on large reads; authorization checks go through the `Auth` collection; use the `QueryBuilder` for list endpoints.

## 6. Base Database Collections

- `auths` — credentials, role, activation/verification state (+ attempt counters)
- `users` / `admins` — profiles linked via `authId`
- `chats` — participant pairs; `messages` — chat messages keyed by `chatId`
- `notifications` — per-user notifications (indexed `{ toId, isRead }`)
- `feedbacks`, `reviews`, `manages` — feature collections
