import { defineConfig } from "@playwright/test";
import { baseConfig } from "./playwright.base.config";

export default defineConfig({
  ...baseConfig,
  // VRT (Chromatic) 用のテストは playwright.vrt.config.ts / `pnpm vrt` で別途実行する
  testIgnore: /vrt\.spec\.ts$/,
});
