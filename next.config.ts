import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
};

export default nextConfig;

// next build（本番ビルド）では実行せず、next dev 時のみ Cloudflare bindings を初期化する
if (process.env.NODE_ENV === "development") {
  initOpenNextCloudflareForDev();
}
