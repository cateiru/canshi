// `scripts/` の運用スクリプトで共通の、D1 を Drizzle で読み書きするための小さなヘルパー。
//
// SQL を文字列で組み立てて `wrangler d1 execute` に渡すと、値のエスケープを誤ったときに SQL インジェクションに
// なりうる。そのため、wrangler の `getPlatformProxy` で D1 のバインディングを取り（ローカルは Miniflare の
// SQLite、`--remote` はリモートのバインディング）、メインアプリと同じ Drizzle のスキーマで読み書きする。
// 値はすべてバインドパラメーターで渡す
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { drizzle } from "drizzle-orm/d1";
import { getPlatformProxy, unstable_readConfig } from "wrangler";

// メインアプリのスキーマ（`src/db/schema`）は、拡張子を付けずに相対パスで import し合う
// （Next.js のバンドラー向けの書き方）。Node.js はそのままでは解決できないため、見つからなかった
// 相対パスの import だけ `.ts` を付けて解決し直す
registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (
        (specifier.startsWith("./") || specifier.startsWith("../")) &&
        path.extname(specifier) === ""
      ) {
        return nextResolve(`${specifier}.ts`, context);
      }
      throw error;
    }
  },
});

// 上のフックを登録してから読み込むため、静的な import にしない
export const schema: typeof import("../src/db/schema/index.ts") = await import(
  "../src/db/schema/index.ts"
);

export const ID_PATTERN = /^[A-Za-z0-9_-]+$/;

/** 利用者に伝えるエラー。`runScript` がメッセージを表示して終了コードを 1 にする */
class ScriptError extends Error {}

export function fail(message: string): never {
  throw new ScriptError(message);
}

/**
 * スクリプトの本体を実行する。`fail` で中断したときは、メッセージを表示して終了コードを 1 にする
 * （`process.exit` で止めず、`openDatabase` の後片付けを `finally` で行えるようにする）
 */
export async function runScript(main: () => Promise<void>) {
  try {
    await main();
  } catch (error) {
    if (error instanceof ScriptError) {
      console.error(`エラー: ${error.message}`);
      process.exitCode = 1;
      return;
    }
    throw error;
  }
}

function createDb(d1: D1Database) {
  return drizzle(d1, { schema });
}

export type ScriptDb = ReturnType<typeof createDb>;

/**
 * メインアプリの D1（`wrangler.migrations.toml` の `DB`）に Drizzle でつなぐ。`--local` は `wrangler d1 execute --local` と
 * 同じローカルの SQLite（`persistTo` は `--persist-to` と同じ。省略時は `.wrangler/state`）を、`--remote` は
 * 本番の D1 を使う（`wrangler login` 済みであること）。使い終わったら `close` を呼ぶ
 */
export async function openDatabase(target: {
  local: boolean;
  persistTo?: string;
}): Promise<{ db: ScriptDb; close: () => Promise<void> }> {
  // wrangler の型定義（`@cloudflare/workers-utils`）は解決できず any になるため、使う形を明示する
  const config: {
    compatibility_date?: string;
    d1_databases: {
      binding: string;
      database_name?: string;
      database_id?: string;
    }[];
  } = unstable_readConfig({ config: "wrangler.migrations.toml" });
  const binding = config.d1_databases.find((d1) => d1.binding === "DB");
  if (!binding?.database_id) {
    fail("wrangler.migrations.toml に D1 のバインディング DB が見つかりません");
  }

  // `--remote` ではバインディングに `remote: true` が必要なため、DB だけを持つ設定を一時的に書き出して使う
  const configDir = mkdtempSync(path.join(tmpdir(), "canshi-scripts-"));
  const configPath = path.join(configDir, "wrangler.json");
  writeFileSync(
    configPath,
    JSON.stringify({
      name: "canshi-scripts",
      compatibility_date: config.compatibility_date,
      d1_databases: [
        {
          binding: "DB",
          database_name: binding.database_name,
          database_id: binding.database_id,
          remote: !target.local,
        },
      ],
    }),
  );

  try {
    const proxy = await getPlatformProxy<{ DB: D1Database }>({
      configPath,
      envFiles: [],
      // `getPlatformProxy` の永続化先は、`--persist-to` で指定するディレクトリの下の `v3`
      persist: target.local
        ? {
            path: path.resolve(target.persistTo ?? ".wrangler/state", "v3"),
          }
        : false,
      remoteBindings: !target.local,
    });
    return {
      db: createDb(proxy.env.DB),
      close: async () => {
        await proxy.dispose();
        rmSync(configDir, { recursive: true, force: true });
      },
    };
  } catch (error) {
    rmSync(configDir, { recursive: true, force: true });
    throw error;
  }
}

/** 実行してよいかを確認する。`y` 以外なら false */
export async function confirm() {
  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const answer = await readline.question("実行しますか？ [y/N] ");
  readline.close();
  return answer.trim().toLowerCase() === "y";
}
