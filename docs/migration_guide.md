# TypeScript Migration Guide

## Detection Result (This Repo)

This project is CommonJS in practice, not ESM.

**Evidence from your repo:**

- `package.json` has no `"type": "module"`.
- Entry files `src/app.js` and `src/server.js` use `require(...)` and `module.exports`.
- Domain files under `src/app/module` follow CommonJS exports/imports.

## Strategy Choice

Use **incremental migration** (not big-bang).

**Why this is safest for your exact codebase:**

- Many modules have hidden JS issues that TS will expose (missing imports, undefined symbols, request augmentation needs).
- You want minimal breakage and unchanged behavior.
- Incremental lets `allowJs` keep app running while converting module-by-module.
- You can ship at every phase with rollback points.

---

## Phase 0 - Baseline and Safety Snapshot

### Goal

Create a safe starting point and baseline behavior before touching code.

### Commands

```bash
git checkout -b chore/ts-migration
npm install
Copy-Item .env.example .env -ErrorAction SilentlyContinue
npm run start
```

### Exact file changes

No file changes yet.

### Verification checklist

- [ ] Server boots on current JS path.
- [ ] `GET /` returns the same response as now.
- [ ] Auth login/register routes still respond as before.

### Rollback tip

```bash
git reset --hard
git switch main
```

---

## Phase 1 - Tooling Bootstrap (No Runtime Behavior Change)

### Goal

Add TypeScript build/run/lint pipeline while still supporting JS files.

### Commands

```bash
npm i -D typescript tsx rimraf eslint @eslint/js typescript-eslint prettier @types/node @types/express @types/cors @types/cookie-parser @types/jsonwebtoken @types/multer @types/nodemailer @types/validator @types/bcrypt
```

### Exact file changes

**Update `package.json` scripts:**

```diff
 {
   "scripts": {
-    "start": "node src/server.js",
-    "dev": "nodemon src/server.js",
+    "start": "node dist/server.js",
+    "start:js": "node src/server.js",
+    "dev": "tsx watch src/server.ts",
+    "dev:js": "nodemon src/server.js",
+    "clean": "rimraf dist",
+    "build": "npm run clean && tsc -p tsconfig.json",
+    "typecheck": "tsc -p tsconfig.json --noEmit",
     "memory-usage": "node --trace_gc src/server.js",
-    "lint:check": "eslint --ignore-path .eslintignore --ext .js .",
-    "lint:fix": "eslint . --fix",
+    "lint:check": "eslint .",
+    "lint:fix": "eslint . --fix",
-    "prettier:check": "prettier --ignore-path .gitignore --check \"**/*.+(js|json)\"",
+    "prettier:check": "prettier --check \"**/*.{js,ts,json,md}\"",
     "prettier:fix": "prettier --write .",
-    "make:file": "node src/util/generateModule.js"
+    "make:file": "tsx src/util/generateModule.ts"
   },
   "lint-staged": {
-    "src/**/*.js": "yarn lint-prettier"
+    "src/**/*.{js,ts}": "eslint --fix"
   }
 }
```

**Add `tsconfig.json` at repo root:**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "node",
    "rootDir": "./src",
    "outDir": "./dist",
    "allowJs": true,
    "checkJs": false,
    "strict": false,
    "noImplicitAny": false,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "sourceMap": true,
    "types": ["node"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "uploads", "logs"]
}
```

**Add `eslint.config.mjs`:**

```javascript
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";

export default defineConfig(
  { ignores: ["dist/**", "node_modules/**", "uploads/**", "logs/**"] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
);
```

### Verification checklist

- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] `dist/` is generated.
- [ ] JS runtime path still works with `npm run start:js`.

### Rollback tip

Keep this phase in its own commit.
If build script causes issues, temporarily keep `start` and `dev` pointing to JS scripts.

---

## Phase 2 - Shared Types and Express Augmentation

### Goal

Enable safe typing for `req.user`, `req.uploadedFiles`, and auth payloads without changing behavior.

### Commands

```bash
New-Item -ItemType Directory -Force src/types | Out-Null
```

### Exact file changes

**Add `src/types/auth.types.ts`:**

```typescript
export type AppRole = "USER" | "ADMIN" | "SUPER_ADMIN" | "DRIVER";

export interface AuthUserPayload {
  authId: string;
  userId: string;
  email: string;
  role: AppRole;
  iat?: number;
  exp?: number;
}
```

**Add `src/types/express.d.ts`:**

```typescript
import type { AuthUserPayload } from "./auth.types";

declare global {
  namespace Express {
    interface Request {
      user?: AuthUserPayload;
      uploadedFiles?: string[];
    }
  }
}

export {};
```

**Add `src/types/common.types.ts`:**

```typescript
export interface ApiResponse<T = unknown> {
  statusCode: number;
  success: boolean;
  message?: string | null;
  meta?: Record<string, unknown>;
  data?: T | null;
  activationToken?: string | null;
}
```

### Verification checklist

- [ ] `npm run typecheck`
- [ ] No TS error about `req.user` type definition file loading.

### Rollback tip

If augmentation is not detected, ensure file is under `src/**/*` and includes `export {}`.

---

## Phase 3 - Convert Core Runtime First

### Goal

Convert app bootstrap/core utilities before domain modules.

### Commands

```bash
git mv src/app.js src/app.ts
git mv src/server.js src/server.ts
git mv src/config/index.js src/config/index.ts
git mv src/util/jwtHelpers.js src/util/jwtHelpers.ts
git mv src/util/catchAsync.js src/util/catchAsync.ts
git mv src/util/sendResponse.js src/util/sendResponse.ts
git mv src/app/middleware/globalErrorHandler.js src/app/middleware/globalErrorHandler.ts
```

### Exact file changes

**`src/util/jwtHelpers.ts`:**

```typescript
import jwt from "jsonwebtoken";

export const createToken = (
  payload: object,
  secret: string,
  expireTime: string,
): string => jwt.sign(payload, secret, { expiresIn: expireTime });

export const createResetToken = (
  payload: object,
  secret: string,
  expireTime: string,
): string =>
  jwt.sign(payload, secret, { algorithm: "HS256", expiresIn: expireTime });

export const verifyToken = <T>(token: string, secret: string): T =>
  jwt.verify(token, secret) as T;

export const jwtHelpers = { createToken, verifyToken, createResetToken };
```

**`src/util/catchAsync.ts`** (important fix: missing import currently exists in JS):

```typescript
import type { NextFunction, Request, Response } from "express";
import deleteUploadedFiles from "./deleteUploadedFiles";

type AsyncHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<unknown>;

const catchAsync =
  (fn: AsyncHandler) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      return await fn(req, res, next);
    } catch (error) {
      deleteUploadedFiles(req.uploadedFiles);
      next(error);
    }
  };

export default catchAsync;
```

**`src/util/sendResponse.ts`:**

```typescript
import type { Response } from "express";
import type { ApiResponse } from "../types/common.types";

const sendResponse = <T>(res: Response, data: ApiResponse<T>) => {
  const responseData = {
    statusCode: data.statusCode,
    success: data.success,
    message: data.message ?? null,
    meta: data.meta ?? undefined,
    data: data.data ?? null,
    activationToken: data.activationToken ?? null,
  };

  if (responseData.activationToken === null)
    delete responseData.activationToken;
  res.status(data.statusCode).json(responseData);
};

export default sendResponse;
```

### Verification checklist

- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] `npm run start`
- [ ] API boots from `dist/server.js`.
- [ ] Root route still returns same payload.

### Rollback tip

If boot fails, temporarily switch `dev` to `dev:js` and convert one file at a time.

---

## Phase 4 - Auth + Mongoose Model Typing

### Goal

Type the highest-risk path first: JWT auth + OTP + cron + user payload.

### Commands

```bash
git mv src/app/module/auth/Auth.js src/app/module/auth/Auth.ts
git mv src/app/module/auth/auth.service.js src/app/module/auth/auth.service.ts
git mv src/app/module/auth/auth.controller.js src/app/module/auth/auth.controller.ts
git mv src/app/module/auth/auth.routes.js src/app/module/auth/auth.routes.ts
git mv src/app/middleware/auth.js src/app/middleware/auth.ts
```

### Exact file changes

**Model typing pattern (`Auth.ts`):**

```typescript
import { Schema, model, type Model } from "mongoose";
import bcrypt from "bcrypt";
import validator from "validator";
import config from "../../../config";

interface IAuth {
  name: string;
  email: string;
  password: string;
  role: "USER" | "ADMIN";
  isVerified?: boolean;
  isBlocked?: boolean;
  isActive?: boolean;
  verificationCode?: string;
  verificationCodeExpire?: Date;
  activationCode?: string;
  activationCodeExpire?: Date;
}

interface AuthModel extends Model<IAuth> {
  isAuthExist(email: string): Promise<IAuth | null>;
  isPasswordMatched(
    givenPassword: string,
    savedPassword: string,
  ): Promise<boolean>;
}

const AuthSchema = new Schema<IAuth, AuthModel>(
  {/* keep same schema */},
  { timestamps: true },
);

AuthSchema.statics.isAuthExist = function (email: string) {
  return this.findOne(
    { email },
    {
      name: 1,
      email: 1,
      password: 1,
      role: 1,
      isActive: 1,
      isBlocked: 1,
      isVerified: 1,
    },
  );
};

AuthSchema.statics.isPasswordMatched = function (
  givenPassword: string,
  savedPassword: string,
) {
  return bcrypt.compare(givenPassword, savedPassword);
};

AuthSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(
    this.password,
    Number(config.bcrypt_salt_rounds),
  );
  next();
});

export default model<IAuth, AuthModel>("Auth", AuthSchema);
```

**Auth middleware (`auth.ts`) with typed payload:**

```typescript
import type { NextFunction, Request, Response } from "express";
import { status as httpStatus } from "http-status";
import config from "../../config";
import ApiError from "../../error/ApiError";
import { jwtHelpers } from "../../util/jwtHelpers";
import Auth from "../module/auth/Auth";
import type { AuthUserPayload } from "../../types/auth.types";

const auth =
  (roles: string[], isAccessible = true) =>
  async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const tokenWithBearer = req.headers.authorization;
      if (!tokenWithBearer && !isAccessible) return next();
      if (!tokenWithBearer)
        throw new ApiError(
          httpStatus.UNAUTHORIZED,
          "You are not authorized for this role",
        );
      if (!tokenWithBearer.startsWith("Bearer "))
        throw new ApiError(httpStatus.UNAUTHORIZED, "Invalid token format");

      const token = tokenWithBearer.split(" ")[1];
      const verifyUser = jwtHelpers.verifyToken<AuthUserPayload>(
        token,
        config.jwt.secret,
      );
      req.user = verifyUser;

      const isExist = await Auth.findById(verifyUser.authId);
      if (!isExist)
        throw new ApiError(httpStatus.UNAUTHORIZED, "You are not authorized");

      if (roles.length && !roles.includes(verifyUser.role)) {
        throw new ApiError(
          httpStatus.FORBIDDEN,
          "Access Forbidden: You do not have permission to perform this action",
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };

export default auth;
```

### Verification checklist

- [ ] Registration/login/activation still work.
- [ ] `req.user` is recognized in controllers.
- [ ] Cron cleanup still executes from auth service.

### Rollback tip

If auth path breaks, revert just auth files:

```bash
git checkout -- src/app/module/auth src/app/middleware/auth.ts
```

---

## Phase 5 - Type Socket, Multer, Error Handler, Stripe/Nodemailer Helpers

### Goal

Cover the non-REST parts that usually break TypeScript migrations.

### Commands

```bash
git mv src/connection/socket.js src/connection/socket.ts
git mv src/socket/socketHandlers.js src/socket/socketHandlers.ts
git mv src/socket/socket.controller.js src/socket/socket.controller.ts
git mv src/socket/chat.socket.controller.js src/socket/chat.socket.controller.ts
git mv src/app/middleware/fileUploader.js src/app/middleware/fileUploader.ts
git mv src/util/sendEmail.js src/util/sendEmail.ts
git mv src/util/emailHelpers.js src/util/emailHelpers.ts
```

### Exact file changes

**Add `src/socket/socket.types.ts`:**

```typescript
export interface ServerToClientEvents {
  send_message: (payload: unknown) => void;
  socket_error: (payload: { status: number; message: string }) => void;
  online_status: (payload: unknown) => void;
  update_location: (payload: unknown) => void;
}

export interface ClientToServerEvents {
  send_message: (payload: {
    receiverId: string;
    chatId: string;
    message: string;
  }) => void;
}
```

**Type Multer middleware (`fileUploader.ts`):**

```typescript
import multer from "multer";
import fs from "fs";
import type { Request } from "express";

type FileCb = (error: Error | null, filename?: string) => void;

const allowedMimeTypes = ["image/jpeg", "image/png", "image/jpg", "image/webp"];

const uploadFile = () => {
  const storage = multer.diskStorage({
    destination(req: Request, file, cb) {
      const uploadPath = `uploads/${file.fieldname}`;
      if (!fs.existsSync(uploadPath))
        fs.mkdirSync(uploadPath, { recursive: true });
      if (allowedMimeTypes.includes(file.mimetype)) cb(null, uploadPath);
      else cb(new Error("Invalid file type"));
    },
    filename(req: Request, file, cb: FileCb) {
      const name = `${Date.now()}-${file.originalname}`;
      if (!req.uploadedFiles) req.uploadedFiles = [];
      req.uploadedFiles.push(`uploads/${file.fieldname}/${name}`);
      cb(null, name);
    },
  });

  return multer({ storage }).fields([{ name: "profile_image", maxCount: 1 }]);
};

export { uploadFile };
```

**Stripe typing pattern for future usage:**

```typescript
import Stripe from "stripe";
import config from "../config";

export const stripeClient = new Stripe(config.stripe.stripe_secret_key, {
  apiVersion: "2025-03-31.basil",
});
```

### Verification checklist

- [ ] Socket connection/disconnect works.
- [ ] File upload still stores under same folders.
- [ ] Email sender still compiles and sends.

### Rollback tip

Keep socket and multer in separate commits, so you can revert one subsystem without losing the other.

---

## Phase 6 - Convert Remaining Domain Modules in Controlled Batches

### Goal

Finish module-by-module conversion without destabilizing the whole app.

### Commands

Run this sequence per module folder:

```bash
git mv src/app/module/user/*.js src/app/module/user/
git mv src/app/module/admin/*.js src/app/module/admin/
git mv src/app/module/notification/*.js src/app/module/notification/
git mv src/app/module/feedback/*.js src/app/module/feedback/
git mv src/app/module/review/*.js src/app/module/review/
git mv src/app/module/manage/*.js src/app/module/manage/
git mv src/app/module/dashboard/*.js src/app/module/dashboard/
git mv src/app/module/chat/*.js src/app/module/chat/
```

Then rename extensions manually to `.ts` in each batch and fix imports/types before next batch:

```bash
npm run typecheck
npm run build
```

### Exact file changes

Use this exact pattern in each service/controller:

- Add request/user payload types.
- Replace `module.exports` with `export default` or named exports consistently.
- Keep business logic unchanged.
- Fix only compile blockers, not feature behavior.

### Verification checklist

- [ ] After each module batch, run typecheck/build/start.
- [ ] Hit at least one route from that module.

### Rollback tip

If one module explodes, `git restore` that folder and proceed with another, then return.

---

## Phase 7 - Migrate Module Generator to TypeScript-Ready Output

### Goal

New generated modules should be `.ts` and compile immediately.

### Commands

```bash
git mv src/util/fileTemplates.js src/util/fileTemplates.ts
git mv src/util/generateModule.js src/util/generateModule.ts
```

### Exact file changes

In `fileTemplates.ts`, generate `import`/`export` TS syntax and typed stubs.

In `generateModule.ts`, accept module name from CLI:

```typescript
const moduleName = process.argv[2];
if (!moduleName) throw new Error("Usage: npm run make:file -- <ModuleName>");
```

- Write `.ts` files, not `.js`.
- Create module path under `src/app/module/<moduleNameLowerCase>` (current script points to wrong directory under util).

### Verification checklist

- [ ] `npm run make:file -- TestModule`
- [ ] `npm run typecheck`
- [ ] New files generated in correct module directory.
- [ ] Generated files compile.

### Rollback tip

Keep old JS generator as `generateModule.legacy.js` until this phase is green.

---

## Phase 8 - Final Cutover and Strictness Ramp

### Goal

Remove JS fallback, enforce TS-only build, keep behavior unchanged.

### Commands

```bash
npm run build
npm run start
npm run lint:check
```

Then tighten `tsconfig.json`:

```diff
- "allowJs": true,
- "strict": false,
- "noImplicitAny": false,
+ "allowJs": false,
+ "strict": true,
+ "noImplicitAny": true
```

### Exact file changes

- Remove `dev:js` and `start:js` when fully green.
- Keep `dist/` output for production.
- Ensure imports no longer point to `.js` files.

### Verification checklist

- [ ] `npm run typecheck` passes with `allowJs: false`.
- [ ] `npm run build` passes clean.
- [ ] `npm run start` serves same API responses.
- [ ] Socket, auth, file upload, cron, email still operational.

### Rollback tip

If strict mode causes too many blockers, keep `strict: false`, ship, then tighten rule-by-rule later.

---

## Common Migration Errors You’ll Hit Here (and Fix)

- **Property `user` does not exist on type `Request`.**
  - **Fix:** add `src/types/express.d.ts` augmentation.
- **Property `uploadedFiles` does not exist on type `Request`.**
  - **Fix:** same augmentation file.
- **Cannot find name `deleteUploadedFiles` in `catchAsync`.**
  - **Fix:** import it in converted `catchAsync.ts`.
- **Cannot find name `deleteFalsyField` in user service.**
  - **Fix:** explicit import in `src/app/module/user/user.service.ts` after conversion.
- **Cannot find name `sendResponse` in dashboard controller.**
  - **Fix:** import missing utility.
- **Cannot find name `Car` / `User` / `Subscription` / `Transaction`.**
  - **Fix:** add missing model imports or isolate incomplete legacy logic behind `TODO` stubs temporarily.
- **Auth route role mismatch (`auth(EnumUserRole.ADMIN)` vs expected array).**
  - **Fix:** pass array consistently: `auth([EnumUserRole.ADMIN])`.
- **`config.bcrypt_salt_rounds` undefined.**
  - **Fix:** add `bcrypt_salt_rounds: process.env.BCRYPT_SALT_ROUNDS` to config type/object.
- **`NODE_ENV` mismatch with `.env.example` (`NODE_DEV`).**
  - **Fix:** standardize on one key (`NODE_ENV`) in env + config.
- **Socket event names used but not declared in enum.**
  - **Fix:** add missing enum members or remove dead paths before strict typing.
- **`http-status` import shape confusion.**
  - **Fix:** use one style everywhere, e.g. `import { status } from "http-status"`.
- **Circular dependency surprises after ES import conversion.**
  - **Fix:** keep module boundaries and export style stable; avoid barrel files until migration completes.

---

## Definition of Done

- [ ] All source files under `src` are `.ts` or `.d.ts`.
- [ ] `allowJs` is `false`.
- [ ] `npm run typecheck` passes.
- [ ] `npm run build` outputs `dist` cleanly.
- [ ] `npm run start` runs from `dist/server.js`.
- [ ] API response JSON shapes are unchanged for key endpoints.
- [ ] Auth JWT flow, OTP activation, cron cleanup, socket messaging, Multer uploads, and nodemailer paths all verified.
- [ ] Module generator creates TypeScript-ready module files.
- [ ] Lint/prettier run on `.ts` files.
- [ ] No runtime `Cannot find module` due stale `.js` import paths.

---

## Clean TypeScript Project Tree (Target)

```text
server-setup-template-main/
├─ src/
│  ├─ app.ts
│  ├─ server.ts
│  ├─ types/
│  │  ├─ auth.types.ts
│  │  ├─ common.types.ts
│  │  └─ express.d.ts
│  ├─ app/
│  │  ├─ middleware/*.ts
│  │  ├─ routes/index.ts
│  │  └─ module/
│  │     ├─ auth/*.ts
│  │     ├─ user/*.ts
│  │     ├─ admin/*.ts
│  │     ├─ review/*.ts
│  │     ├─ notification/*.ts
│  │     ├─ chat/*.ts
│  │     ├─ feedback/*.ts
│  │     ├─ manage/*.ts
│  │     └─ dashboard/*.ts
│  ├─ builder/queryBuilder.ts
│  ├─ config/index.ts
│  ├─ connection/*.ts
│  ├─ error/*.ts
│  ├─ mail/*.ts
│  ├─ socket/*.ts
│  └─ util/*.ts
├─ dist/
├─ tsconfig.json
├─ eslint.config.mjs
└─ package.json
```

If you want, I can do the first real migration commit for you next: Phase 1 + Phase 2 file edits in this repo so you can run immediately.
