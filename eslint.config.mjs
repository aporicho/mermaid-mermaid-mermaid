import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: [
      ".next/**",
      ".next-build/**",
      ".next-dev/**",
      "coverage/**",
      "dist/**",
      "node_modules/**",
      "out/**",
      "outputs/**",
      "src-tauri/**",
      "*.tsbuildinfo",
      "package-lock.json"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["scripts/**/*.mjs"],
    rules: {
      "no-undef": "off"
    }
  },
  {
    files: ["electron/**/*.cjs"],
    rules: {
      "no-undef": "off",
      "@typescript-eslint/no-require-imports": "off"
    }
  },
  {
    files: ["src/**/*.{ts,tsx}", "*.ts"],
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      }
    },
    plugins: {
      "react-hooks": reactHooks
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "no-undef": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_"
        }
      ]
    }
  }
];
