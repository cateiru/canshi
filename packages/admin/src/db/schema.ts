/**
 * メインアプリの Drizzle スキーマ（リポジトリルートの `src/db/schema`）。管理画面の DB 操作は、
 * メインアプリと同じスキーマで Drizzle を通して行い、SQL を文字列で組み立てない。
 *
 * スキーマのファイルは `drizzle-orm` と相対パスだけを import する（Next.js のパスエイリアス `@/` などを
 * 使わない）ため、管理画面からそのまま読み込める。スキーマを変えたときは、`pnpm --filter @canshi/admin test`
 * （リポジトリルートの `drizzle/` のマイグレーションを適用した DB で実行する）で管理画面のクエリも確かめる
 */
export * from "../../../../src/db/schema";
