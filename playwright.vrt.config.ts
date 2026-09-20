import { defineConfig } from "@playwright/test";
import { baseConfig } from "./playwright.base.config";

export default defineConfig({
  ...baseConfig,
  testMatch: /vrt\.spec\.ts$/,
});
