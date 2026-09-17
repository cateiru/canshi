import type { ChromaticConfig } from "@chromatic-com/playwright";
import { defineConfig } from "@playwright/test";
import { baseConfig } from "./playwright.base.config";

export default defineConfig<ChromaticConfig>({
  ...baseConfig,
  testMatch: /vrt\.spec\.ts$/,
  use: {
    ...baseConfig.use,
    // Next.js の dev インジケータは実行タイミングで見た目が変わりうるため VRT の比較対象から除外する
    ignoreSelectors: ["nextjs-portal"],
  },
});
