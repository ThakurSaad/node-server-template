You are an expert Principal Software Engineer and System Architect specializing in JavaScript to TypeScript enterprise migrations. I am planning to migrate our entire codebase from JS to TS.

Below is the technical documentation, architecture overview, and/or code snippets of the current codebase.

**Your Tasks:**

1. **Architecture & Dependency Analysis:** Thoroughly analyze the provided documentation. Summarize the core architecture and identify key dependencies or patterns that will impact the TS migration.
2. **Migration Strategy:** Outline a step-by-step technical strategy to transition this specific codebase. Should we use a progressive migration (allowing `allowJs`) or a big-bang approach? What should our initial `tsconfig.json` strictness look like?
3. **Risk Assessment & "Gotchas":** Identify the biggest technical hurdles based on this documentation. Highlight specific areas that will be difficult to type (e.g., dynamic object mutation, complex higher-order functions, or libraries lacking `@types`).
4. **Effort & Automation Estimation:** Instead of a generic score, provide a realistic assessment of how much of this migration can be reliably automated (using tools like `ts-migrate`) versus how much will require manual engineering intervention. Categorize the major components by expected migration difficulty (Low, Medium, High).

**Constraints:**

- Do not guess or hallucinate. If the documentation lacks details on a specific area, explicitly state that you need more information to assess it.
- Think step-by-step. Double-check your proposed strategy against standard enterprise TypeScript best practices before finalizing your response.

================

# Project Technical Documentation

This document serves as a comprehensive technical overview of the current project state. It is designed to act as a foundational context guide for AI assistants or developers aiming to use this repository as a starting template for future development.

## 1. High-Level Architecture

This project is a backend RESTful API built on the **Node.js** runtime using the **Express.js** framework. It implements a **Modular Monolith Architecture** meaning the business logic is split by domains (e.g., `user`, `auth`, `review`), and each domain has its own encapsulated components (Controllers, Services, Models, Routes).

## 2. Technology Stack

- **Language/Runtime:** JavaScript / Node.js
- **Framework:** Express.js (v5.x)
- **Database Object Modeling (ODM):** Mongoose
- **Database Engine:** MongoDB
- **Authentication:** JSON Web Tokens (JWT) & `bcrypt` for password hashing
- **Real-time Communication:** Socket.io
- **Email Service:** Nodemailer (SMTP based)
- **File Uploads:** Multer (with logic components in utilities)
- **Background Jobs:** Node-cron
- **Payment Gateway integrations:** Stripe
- **Logging:** Winston & Winston Daily Rotate File

## 3. Directory Structure

```
├── src/
│   ├── app/
│   │   ├── middleware/       # Shared Express middlewares (e.g., Auth checkers, Global Error Handlers)
│   │   ├── module/           # Modularized domain logic
│   │   │   ├── admin/
│   │   │   ├── auth/         # Handles Registration, Login, OTP verification
│   │   │   ├── chat/
│   │   │   ├── dashboard/
│   │   │   ├── feedback/
│   │   │   ├── manage/
│   │   │   ├── notification/ # Stores and retrieves system/app notifications
│   │   │   ├── review/
│   │   │   └── user/         # User profile definitions and mutations
│   │   └── routes/           # Central API Router index mapping
│   ├── config/               # Processes `.env` environmental variables
│   ├── connection/           # System level connections
│   │   ├── connectDB.js      # Mongoose MongoDB connection
│   │   ├── socket.js         # Configures the Socket.io WebSocket server
│   │   └── socketCors.js
│   ├── error/                # Custom Error classes and custom error transformers
│   │   ├── ApiError.js       # Standardized API Error Thrower
│   │   ├── globalErrorHandler.js  # Main catcher and formatter
│   │   └── NotFoundHandler.js
│   ├── mail/                 # Email templates processing
│   ├── util/                 # Project-wide utility helper scripts (e.g., `logger.js`, `jwtHelpers.js`, `generateModule.js`)
│   ├── app.js                # Core Express application setup and bindings
│   └── server.js             # Starting execution point linking Express, Sockets, and Mongoose
├── .env.example              # Sample environment constraints needed to run the project
└── package.json              # Includes dependency manifests and dev scripts (e.g., `make:file`)
```

## 4. Core System Workflows

### Authentication and Authorization

The auth system uses a multi-layered approach involving **Two Databases Collections** conceptually tied together:

- `Auth`: Central authority for system credentials. Holds `email`, `password`, `role` (ADMIN, USER), OTP codes, and activation statuses.
- `User` | `Admin`: Sub-profile attachments tied via the `authId`. These maintain separate, domain-specific profile details without polluting credentials logic.
- **Registration Flow:** User registers -> System generates a 3-digit activation code -> Sends code to email (Nodemailer) -> Stores inactive user state.
- **Activation Flow:** User inputs OTP -> System verifies OTP expiry -> State transitions to active -> JWT (Access/Refresh pairs) issued.
- Periodic cleanup runs in the background (`node-cron`) to prune unverified, expired OTP credentials from the DB.

### Error Handling

The repository employs centralized and graceful error handling strategies. Using an `ApiError` utility (combining http-status codes and custom messages), any errors thrown within modules are bubbled up to `globalErrorHandler`.

- Auto-handles `ValidationError`, `CastError`, `MulterError`, `DuplicateKeyError`, etc.
- Parses backend-specific errors and formats them into a strict, predictable JSON interface for frontend consumption:
  ```json
  {
      "success": false,
      "message": "Error reason",
      "errorMessages": [...Array of specific field breakdowns]
  }
  ```

### Real-time Communication

Integrated via Socket.io, initialized in `src/connection/socket.js`. The project is already hooked up alongside the Express listening port dynamically allowing dual HTTP + WS usage over the single API port.

## 5. Using as a Template: Best Practices

For AI assistants or developers utilizing this template structure:

1. **Domain Creation Script**: The project includes a `generateModule.js` inside `src/util`. You can invoke it via `npm run make:file` (or configure AI to utilize it) to instantly bootstrap standard boilerplate (`model`, `controller`, `service`, `routes`) folders and files for new entities within `src/app/module`.
2. **Environment Setup**: Copy `.env.example` to `.env` locally. Key integrations require proper config strings: MongoDB URI, JWT Secrets, SMPT Credentials, and Stripe keys.
3. **Database Interactions**: When building on top of the DB logic, ensure to rely on `lean()` during massive mongoose `.find()` fetches to improve performance logic, and remember that any authentication/role specific checking should run through the underlying `Auth` collection, not directly via domain structures unless for Profile fetching.
4. **File handling**: There are strong unlinking tools existing under `src/util/unlinkFile.js` and `deleteUploadedFiles.js` to clear server memory footprint safely.

## 6. Base Database Collections

These are the core established collections, typically handled by their discrete domains:

- `auths` - Core authentication / login credentials
- `admins` - Profile specific schema mapped to `auth.role = ADMIN`
- `users` - Profile specific schema mapped to `auth.role = USER`
- `notifications` - App ecosystem notifications
- `payments` - Ledger for Stripe/Financial interactions

================
