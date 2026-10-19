import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(
  { ignores: ["dist/", "logs/", "uploads/"] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    rules: {
      // Express recognises error handlers by arity: (error, req, res, _next)
      // must keep its unused 4th parameter. "_" marks intentionally unused args.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
    },
  },
);
