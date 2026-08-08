import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import react from "ultracite/oxlint/react";

export default defineConfig({
  extends: [core, react],
  rules: {
    "no-warning-comments": "off", // Allow TODO and FIXME comments
    "no-inline-comments": "off", // Allow nearby comments

    "sort-keys": "off",
    "func-style": "off",

    "typescript/no-unsafe-assignment": "off", // Allow implicit `any` assignments
    "typescript/no-unsafe-call": "off", // Allow implicit `any` calls
    "typescript/no-unsafe-member-access": "off", // Allow member access on implicit `any` values
    "typescript/no-unsafe-type-assertion": "off",
    "typescript/no-unsafe-return": "off",
    "typescript/no-non-null-assertion": "off",
    "typescript/strict-boolean-expressions": "off", // Allow non-boolean conditional checks
    "typescript/consistent-type-definitions": ["error", "type"], // Use `type` instead of `interface`
    "typescript/no-misused-promises": "off", // React Hook Form's handleSubmit returns a Promise-typed handler
    "typescript/strict-void-return": "off", // Allow functions returning Promise<void> where void functions are expected
    "typescript/prefer-regexp-exec": "off", // Allow use of String#match
    "typescript/no-explicit-any": "off",
    "typescript/no-floating-promises": "off",
    "typescript/consistent-return": "off",

    "unicorn/filename-case": "off", // Impossible to enforce consistent filename case due to multiple conventions
    "unicorn/no-array-reduce": "off",

    // --- JSDoc Rules ---
    "jsdoc/require-param": "error",
    "jsdoc/require-param-description": "error",
    "jsdoc/require-returns": "error",
    "jsdoc/require-returns-description": "error",
  },
  options: {
    reportUnusedDisableDirectives: "error",
  },
  ignorePatterns: ["node_modules", "dist", "build", "src/components/ui"],
});
