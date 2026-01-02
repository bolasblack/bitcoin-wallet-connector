import { defineConfig } from "eslint/config"
import tseslint from "typescript-eslint"
import * as react from "eslint-plugin-react"
import * as reactHooks from "eslint-plugin-react-hooks"
import * as eslintConfigPrettier from "eslint-config-prettier"
import * as globals from "globals"

function getDefault<T>(mod: { default: T } | T): T {
  return (mod as { default: T }).default ?? (mod as T)
}

export default defineConfig(
  // Global ignores
  {
    ignores: ["lib/**", "node_modules/**"],
  },

  // ===========================================
  // Base rules (from eslintrc.base.mts)
  // ===========================================
  {
    rules: {
      // off
      "max-classes-per-file": "off",
      "no-shadow": "off",
      // error
      "no-unused-vars": [
        "error",
        {
          vars: "all",
          args: "after-used",
          caughtErrors: "none",
          varsIgnorePattern: "^_",
          argsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      curly: ["error", "multi-line"],
    },
  },

  // ===========================================
  // TypeScript rules (from eslintrc.ts.mts)
  // ===========================================
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.mts", ".storybook/**/*.ts*"],
    extends: [tseslint.configs.recommended],
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      // off
      "no-unused-vars": "off",
      "@typescript-eslint/consistent-type-definitions": "off",
      "@typescript-eslint/no-empty-interface": "off",
      "@typescript-eslint/no-namespace": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-parameter-properties": "off",
      "@typescript-eslint/no-use-before-define": "off",
      "@typescript-eslint/consistent-type-assertions": "off",
      // error (user prefers 'warn' for no-unused-vars)
      "@typescript-eslint/no-unused-vars": [
        "warn", // @c4605/toolconfs suggests: 'error'
        {
          vars: "all",
          args: "after-used",
          caughtErrors: "none",
          varsIgnorePattern: "^_",
          argsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      "@typescript-eslint/explicit-member-accessibility": [
        "error",
        { accessibility: "no-public" },
      ],
      "@typescript-eslint/no-floating-promises": [
        "error",
        { ignoreVoid: true },
      ],
      "@typescript-eslint/explicit-function-return-type": [
        "error",
        { allowExpressions: true },
      ],
    },
  },

  // ===========================================
  // React rules (from eslintrc.react.mts)
  // ===========================================
  {
    files: ["**/*.jsx", "**/*.tsx"],
    extends: [
      react.configs.flat.recommended,
      reactHooks.configs["recommended-latest"],
    ],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      "react/prop-types": "off",
      "react/react-in-jsx-scope": "off",
      "react/display-name": "off",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
    },
  },

  // ===========================================
  // Prettier rules (from eslintrc.prettier.mts)
  // ===========================================
  getDefault(eslintConfigPrettier),
)
