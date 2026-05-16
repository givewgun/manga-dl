import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
      "**/dist/**",
      "**/dist-renderer-types/**",
      "**/coverage/**",
      "node_modules/**",
      "apps/desktop/dist-renderer/**"
    ]
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "no-control-regex": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }]
    }
  },
  {
    files: ["**/*.js", "**/*.mjs", "**/*.cjs"],
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly"
      }
    }
  }
);
