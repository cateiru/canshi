import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  // next dev の DevTools インジケーター（画面左下の丸いバッジ）を無効化する。
  // VRT (e2e/vrt.spec.ts) は `next dev` に対して実行しており、このバッジは
  // クリック状態などにより表示が揺れるため、e2e/vrt-snapshot.ts の
  // ALWAYS_MASKED_SELECTORS でマスクしようとしていたが、DevTools インジケーターの
  // ホスト要素は `display: contents` でレイアウト上のサイズを持たず、Playwright の
  // screenshot({ mask }) はマスク対象要素の bounding box を矩形で塗りつぶす仕組みのため
  // 効かず、実際には差分として検出されてしまっていた
  devIndicators: false,
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
