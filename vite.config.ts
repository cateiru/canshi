import { cloudflare } from "@cloudflare/vite-plugin";
import vinext from "vinext";
import { defineConfig } from "vite";

// vinext（Next.js の API を Vite 上で再実装したもの）で、開発サーバー・ビルドを動かす。
// Worker の設定は `cloudflare.config.ts` にある（Issue #505 の移行の試し）
export default defineConfig({
  plugins: [
    vinext(),
    cloudflare({
      // App Router の RSC・SSR を workerd で動かす
      viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
      // ローカルの D1・R2 は、`wrangler d1 migrations apply --local`（`pnpm db:migrate:local`）や
      // 管理画面（`packages/admin` の `wrangler dev --persist-to ../../.wrangler/state`）と同じ場所に置く
      persistState: { path: ".wrangler/state" },
    }),
  ],
  server: {
    // e2e・VRT（`playwright.base.config.ts`）は 3000 番を見る
    port: 3000,
    strictPort: true,
  },
});
