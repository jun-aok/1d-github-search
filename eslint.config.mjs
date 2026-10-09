import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import tseslint from "typescript-eslint";

// 型安全の原則（docs/design.md 3 節）を機械的に強制する
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...tseslint.configs.strictTypeChecked,
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // 型アサーション禁止（as const は許される）
      "@typescript-eslint/consistent-type-assertions": ["error", { assertionStyle: "never" }],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/ban-ts-comment": "error",
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      // zod はモデルのファイルの中に隠す
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "zod",
              message:
                "zod は src/lib/model/、src/lib/github/parse.ts、src/lib/env.ts の中でだけ使う（docs/design.md 3 節）",
            },
          ],
        },
      ],
      // アイコンは <img> で GitHub から直接読む（docs/design.md 6 節）
      "@next/next/no-img-element": "off",
    },
  },
  {
    files: ["src/lib/model/**/*.ts", "src/lib/github/parse.ts", "src/lib/env.ts"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  {
    // 設定ファイルは型情報付きの lint の対象外
    files: ["*.mjs", "*.ts", "*.mts", "scripts/**/*.mjs"],
    ignores: ["src/**"],
    extends: [tseslint.configs.disableTypeChecked],
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "spike/**",
    "test-results/**",
    "playwright-report/**",
    "mock/**",
    ".claude/**",
  ]),
]);

export default eslintConfig;
