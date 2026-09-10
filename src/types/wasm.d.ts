// Turbopack（next dev / next build）は `?module` 付きの .wasm import を
// コンパイル済み `WebAssembly.Module` として解決する。OpenNext の Cloudflare
// ビルドではこれが静的な .wasm import に書き換えられ、wrangler が
// CompiledWasm として同梱する。Vitest では vitest.config.ts のプラグインが同じ形に解決する
declare module "*.wasm?module" {
  const wasmModule: WebAssembly.Module;
  export default wasmModule;
}
