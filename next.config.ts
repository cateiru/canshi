import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  turbopack: {
    resolveAlias: {
      // `?module` 付きの import では package.json の exports が解決されないため、実ファイルに向ける
      "@cf-wasm/photon/photon.wasm":
        "./node_modules/@cf-wasm/photon/dist/lib/photon_rs_bg.wasm",
    },
  },
};

export default nextConfig;

// next build（本番ビルド）では実行せず、next dev 時のみ Cloudflare bindings を初期化する
if (process.env.NODE_ENV === "development") {
  initOpenNextCloudflareForDev();
}
