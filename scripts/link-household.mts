// 家（households）を作成し、家に未所属の猫（cats.household_id が NULL）を紐付けるスクリプト。
//
// ユーザー・家の導入前から登録されていた猫は、どの家にも所属しないためアプリに表示されない。
// デプロイ後に `/login` でログインして（ユーザーが作成される）から、このスクリプトで
// そのユーザーをオーナーとする家を作り、既存の猫をまとめて紐付ける（docs/deploy.md 参照）。
// 家に未所属の支出記録・ごはん商品・ごはんプリセット（household_id が NULL）も、
// どのユーザーからも見えないため、同じ家に紐付ける。
// ユーザーに紐付いていない Web Push の購読（push_subscriptions.user_id が NULL）も、
// どの通知も届かないため、同じユーザーに紐付ける。
//
// 使い方:
//   pnpm household:link --local  [--persist-to ./.wrangler/state] [--user-id <id>] [--name <家の名前>]
//   pnpm household:link --remote [--user-id <id>] [--name <家の名前>] [--yes]
//
// - `--user-id` を省略すると、最初に登録されたユーザー（`/login` のログインボタンで使われるユーザー）を使う
// - ユーザーがすでに家に所属している場合は新しく作らず、その家に猫を紐付ける（何度実行しても同じ結果になる）
// - `--remote` では実行前に確認する。`--yes` で確認を省略できる
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";

const DEFAULT_HOUSEHOLD_NAME = "わが家";
const ID_PATTERN = /^[A-Za-z0-9_-]+$/;

const { values: args } = parseArgs({
  options: {
    local: { type: "boolean", default: false },
    remote: { type: "boolean", default: false },
    "persist-to": { type: "string" },
    "user-id": { type: "string" },
    name: { type: "string", default: DEFAULT_HOUSEHOLD_NAME },
    yes: { type: "boolean", default: false },
  },
});

/** `wrangler d1 execute --json` の結果の 1 行。列の型は SELECT ごとに呼び出し側で決める */
type Row = Record<string, unknown>;

function fail(message: string): never {
  console.error(`エラー: ${message}`);
  process.exit(1);
}

if (args.local === args.remote) {
  fail("--local か --remote のどちらか一方を指定してください");
}
if (args["user-id"] && !ID_PATTERN.test(args["user-id"])) {
  fail("--user-id の形式が正しくありません");
}
if (!args.name.trim()) {
  fail("--name に家の名前を指定してください");
}

/** SQL の文字列リテラルにする（シングルクォートをエスケープする） */
function quote(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

/** `wrangler d1 execute` で SQL を実行し、最後の文の結果行を返す */
function execute<T extends Row = Row>(sql: string): T[] {
  const wranglerArgs = [
    "exec",
    "wrangler",
    "d1",
    "execute",
    "DB",
    args.local ? "--local" : "--remote",
    "--json",
    "--command",
    sql,
  ];
  if (args["persist-to"]) {
    wranglerArgs.push("--persist-to", args["persist-to"]);
  }
  const output = execFileSync("pnpm", wranglerArgs, {
    encoding: "utf8",
    stdio: ["inherit", "pipe", "inherit"],
  });
  const results: { results?: T[] }[] = JSON.parse(output);
  return results.at(-1)?.results ?? [];
}

type NamedRow = { id: string; name: string };
type CountRow = { count: number };

const [user] = args["user-id"]
  ? execute<NamedRow>(
      `SELECT id, name FROM users WHERE id = ${quote(args["user-id"])} LIMIT 1`,
    )
  : execute<NamedRow>(
      "SELECT id, name FROM users ORDER BY created_at, id LIMIT 1",
    );
if (!user) {
  fail(
    args["user-id"]
      ? `ユーザー ${args["user-id"]} が見つかりません`
      : "ユーザーがいません。先にアプリの /login でログインしてユーザーを作成してください",
  );
}

const [membership] = execute<NamedRow>(
  `SELECT h.id, h.name FROM household_members m
     JOIN households h ON h.id = m.household_id
     WHERE m.user_id = ${quote(user.id)}
     ORDER BY m.created_at, h.id LIMIT 1`,
);
const [{ count: orphanCount }] = execute<CountRow>(
  "SELECT COUNT(*) AS count FROM cats WHERE household_id IS NULL",
);
const [{ count: orphanExpenseCount }] = execute<CountRow>(
  "SELECT COUNT(*) AS count FROM expense_records WHERE household_id IS NULL",
);
const [{ count: orphanFoodProductCount }] = execute<CountRow>(
  "SELECT COUNT(*) AS count FROM food_products WHERE household_id IS NULL",
);
const [{ count: orphanFeedingPresetCount }] = execute<CountRow>(
  "SELECT COUNT(*) AS count FROM feeding_presets WHERE household_id IS NULL",
);
const [{ count: orphanSubscriptionCount }] = execute<CountRow>(
  "SELECT COUNT(*) AS count FROM push_subscriptions WHERE user_id IS NULL",
);

console.log(
  `対象のデータベース: ${args.local ? "ローカル" : "本番（remote）"}`,
);
console.log(`ユーザー: ${user.name}（${user.id}）`);
console.log(
  membership
    ? `家: ${membership.name}（${membership.id}、作成済み）`
    : `家: ${args.name}（新しく作成し、このユーザーをオーナーにする）`,
);
console.log(`家に紐付ける猫: ${orphanCount} 匹`);
console.log(`家に紐付ける支出記録: ${orphanExpenseCount} 件`);
console.log(`家に紐付けるごはん商品: ${orphanFoodProductCount} 件`);
console.log(`家に紐付けるごはんプリセット: ${orphanFeedingPresetCount} 件`);
console.log(
  `ユーザーに紐付ける Push 通知の購読: ${orphanSubscriptionCount} 件`,
);

if (args.remote && !args.yes) {
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

let householdId = membership?.id;
if (!householdId) {
  householdId = randomUUID();
  execute(
    [
      `INSERT INTO households (id, name) VALUES (${quote(householdId)}, ${quote(args.name.trim())})`,
      `INSERT INTO household_members (household_id, user_id, role) VALUES (${quote(householdId)}, ${quote(user.id)}, 'owner')`,
    ].join(";\n"),
  );
  console.log(`家を作成しました（${householdId}）`);
}

execute(
  `UPDATE cats SET household_id = ${quote(householdId)}, updated_at = unixepoch() WHERE household_id IS NULL`,
);
const [{ count: linkedCount }] = execute<CountRow>(
  `SELECT COUNT(*) AS count FROM cats WHERE household_id = ${quote(householdId)}`,
);
console.log(
  `家に未所属だった猫を紐付けました（この家の猫: ${linkedCount} 匹）`,
);

execute(
  `UPDATE expense_records SET household_id = ${quote(householdId)}, updated_at = unixepoch() WHERE household_id IS NULL`,
);
console.log("家に未所属だった支出記録を紐付けました");

// プリセットの明細は同じ家の商品に限るため、商品とプリセットは同じ家にまとめて紐付ける
execute(
  [
    `UPDATE food_products SET household_id = ${quote(householdId)}, updated_at = unixepoch() WHERE household_id IS NULL`,
    `UPDATE feeding_presets SET household_id = ${quote(householdId)}, updated_at = unixepoch() WHERE household_id IS NULL`,
  ].join(";\n"),
);
console.log("家に未所属だったごはん商品・ごはんプリセットを紐付けました");

execute(
  `UPDATE push_subscriptions SET user_id = ${quote(user.id)} WHERE user_id IS NULL`,
);
console.log("ユーザーに未紐付けだった Push 通知の購読を紐付けました");
