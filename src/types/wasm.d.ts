// `?module` 付きの .wasm import を、コンパイル済み `WebAssembly.Module` として解決する。
// vinext（`@cloudflare/vite-plugin`）は Worker の wasm モジュールとして同梱する。
// Vitest では vitest.config.ts のプラグインが同じ形に解決する
declare module "*.wasm?module" {
  const wasmModule: WebAssembly.Module;
  export default wasmModule;
}
