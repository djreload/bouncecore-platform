import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".codex-run/**",
    ".next/**",
    "android-webview/.gradle/**",
    "android-webview/app/build/**",
    "android-webview/build/**",
    "out/**",
    "build/**",
    "next-env.d.ts"
  ])
]);
