import { readFile } from "node:fs/promises";
import { defineConfig, type Plugin } from "vitest/config";

const CSS_TEXT_PREFIX = "\0css-text:";

/**
 * wrangler.jsonc の `rules`（Text）と同じく、CSS を文字列として import する。
 * Vite の CSS の処理に渡らないよう、`.css` で終わらない仮想 id にしてから読み込む
 */
const cssAsText: Plugin = {
  name: "css-as-text",
  enforce: "pre",
  async resolveId(source, importer) {
    if (!source.endsWith(".css")) {
      return null;
    }
    const resolved = await this.resolve(source, importer, { skipSelf: true });
    return resolved
      ? `${CSS_TEXT_PREFIX}${Buffer.from(resolved.id).toString("hex")}`
      : null;
  },
  async load(id) {
    if (!id.startsWith(CSS_TEXT_PREFIX)) {
      return null;
    }
    const filePath = Buffer.from(
      id.slice(CSS_TEXT_PREFIX.length),
      "hex",
    ).toString();
    this.addWatchFile(filePath);
    return `export default ${JSON.stringify(await readFile(filePath, "utf8"))};`;
  },
};

export default defineConfig({
  plugins: [cssAsText],
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
