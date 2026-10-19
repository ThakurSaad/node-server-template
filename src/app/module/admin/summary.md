### Summary of Changes

1. Created Interface:
   • Created admin.interface.ts defining the IAdmin mongoose document interface to ensure full type safety for
   admin
   profiles.

2. Migrated Models:
   • Updated Admin.ts to utilize the IAdmin interface for the Mongoose schema/model and aligned exports
   with other module schemas ( export = Admin ).

3. Migrated Controller:
   • Migrated admin.controller.ts to TypeScript, typed the parameters with Express Request and Response , and
   standard exports.

4. Migrated Routes:
   • Migrated admin.routes.ts to ES import/export format using config.auth_level.admin instead of CommonJS
   require .

5. Migrated Services & Fixed Bugs:
   • Migrated admin.service.ts to TypeScript with strict type annotations.
   • Fixed a bug in deleteMyAccount where it referred to User.findOne instead of Admin.findOne and was
   lacking a User model import.
   • Typed req.files payload for profile images and cleaned up type checks.

6. Build Verification:
   • Added the "test": "npm run build" script to package.json since it was missing.
   • Successfully ran npm test to compile the TypeScript project and verify the build.
