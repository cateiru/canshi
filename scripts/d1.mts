// `scripts/` の運用スクリプトで共通の、`wrangler d1 execute` を呼ぶための小さなヘルパー
import { execFileSync } from "node:child_process";
import { createInterface } from "node:readline/promises";

/** `wrangler d1 execute --json` の結果の 1 行。列の型は SELECT ごとに呼び出し側で決める */
export type Row = Record<string, unknown>;

export const ID_PATTERN = /^[A-Za-z0-9_-]+$/;

export function fail(message: string): never {
  console.error(`エラー: ${message}`);
  process.exit(1);
}

/** SQL の文字列リテラルにする（シングルクォートをエスケープする） */
export function quote(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

/** `wrangler d1 execute` で SQL を実行し、最後の文の結果行を返す関数を作る */
export function createExecutor(target: { local: boolean; persistTo?: string }) {
  return function execute<T extends Row = Row>(sql: string): T[] {
    const wranglerArgs = [
      "exec",
      "wrangler",
      "d1",
      "execute",
      "DB",
      target.local ? "--local" : "--remote",
      "--json",
      "--command",
      sql,
    ];
    if (target.persistTo) {
      wranglerArgs.push("--persist-to", target.persistTo);
    }
    const output = execFileSync("pnpm", wranglerArgs, {
      encoding: "utf8",
      stdio: ["inherit", "pipe", "inherit"],
    });
    const results: { results?: T[] }[] = JSON.parse(output);
    return results.at(-1)?.results ?? [];
  };
}

/** 実行してよいかを確認する。`y` 以外なら中止して終了する */
export async function confirmOrExit() {
  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const answer = await readline.question("実行しますか？ [y/N] ");
  readline.close();
  if (answer.trim().toLowerCase() !== "y") {
    console.log("中止しました");
    process.exit(0);
  }
}
