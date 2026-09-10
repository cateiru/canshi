import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vitest/config";

const dirname = path.dirname(fileURLToPath(import.meta.url));

const WASM_MODULE_SUFFIX = "?module";
const WASM_MODULE_PREFIX = "\0virtual:wasm-module:";

/**
 * Turbopack の `import wasm from "./x.wasm?module"`（コンパイル済み WebAssembly.Module を
 * 返す）を Vitest でも同じ意味で解決するプラグイン。
 * 実行時にファイルを読み込んで `new WebAssembly.Module` に渡す
 */
const wasmModulePlugin: Plugin = {
  name: "wasm-module",
  enforce: "pre",
  async resolveId(source, importer) {
    if (!source.endsWith(`.wasm${WASM_MODULE_SUFFIX}`)) {
      return null;
    }
    const resolved = await this.resolve(
      source.slice(0, -WASM_MODULE_SUFFIX.length),
      importer,
      { skipSelf: true },
    );
    // 実パス（node_modules 配下）をそのまま id に含めると Vitest が外部モジュールとして
    // 扱い Node の ESM ローダーに渡してしまうため、16 進エンコードして仮想 id にする
    return resolved
      ? `${WASM_MODULE_PREFIX}${Buffer.from(resolved.id).toString("hex")}`
      : null;
  },
  load(id) {
    if (!id.startsWith(WASM_MODULE_PREFIX)) {
      return null;
    }
    const filePath = Buffer.from(
      id.slice(WASM_MODULE_PREFIX.length),
      "hex",
    ).toString();
    if (!fs.existsSync(filePath)) {
      throw new Error(`wasm file not found: ${filePath}`);
    }
    return `import fs from "node:fs";
export default new WebAssembly.Module(fs.readFileSync(${JSON.stringify(filePath)}));`;
  },
};

export default defineConfig({
  plugins: [wasmModulePlugin, react()],
  resolve: {
    alias: {
      "@": path.resolve(dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["e2e/**"],
  },
});
