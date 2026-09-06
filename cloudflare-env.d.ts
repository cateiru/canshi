// `wrangler types`（worker-configuration.d.ts）が生成するグローバルな `Env` を
// `@opennextjs/cloudflare` の `CloudflareEnv`（getCloudflareContext() の戻り値の型）へ合成する。
declare global {
  interface CloudflareEnv extends Env {}
}

export {};
