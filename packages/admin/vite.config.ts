import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * 画面（React の SPA、src/client）のビルド。dist/client に書き出し、wrangler.jsonc の `assets` で
 * 静的アセットとして配信する。サーバー（Worker）は wrangler がビルドする。
 *
 * `pnpm dev:client` では画面だけを Vite の開発サーバーで動かし、API（`/api/*`）は別に起動した
 * `pnpm dev`（wrangler dev、既定で 8787 番）へ送る
 */
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist/client",
    emptyOutDir: true,
    // 運用者だけが使う画面で、分割して読み込みを速くするほどの利点がないため、1 つのまま警告しない
    chunkSizeWarningLimit: 1024,
  },
  server: {
    proxy: {
      "/api": "http://localhost:8787",
    },
  },
});
