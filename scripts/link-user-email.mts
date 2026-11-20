// ユーザーのログインに使うメールアドレス（users.email）を設定するスクリプト。
//
// メールアドレスは画面に表示せず、本人も変えられない。メールアドレスの変更はお問い合わせで受け、
// このスクリプトで設定する（docs/deploy.md 参照）。メールアドレスは、アプリと同じ方法
// （`src/features/auth/domain/email.ts`）で正規化して保存する。
//
// 使い方:
//   pnpm user:link-email --remote --user-id <id> --email <メールアドレス> [--yes]
//   pnpm user:link-email --local [--persist-to ./.wrangler/state] --user-id <id> --email <メールアドレス>
//
// - 別のユーザーがすでに同じメールアドレスで登録されている場合は、何もせずにエラーにする
// - `--remote` では実行前に確認する。`--yes` で確認を省略できる
import { parseArgs } from "node:util";
import { normalizeEmail } from "../src/features/auth/domain/email.ts";
import {
  confirmOrExit,
  createExecutor,
  fail,
  ID_PATTERN,
  quote,
} from "./d1.mts";

const { values: args } = parseArgs({
  options: {
    local: { type: "boolean", default: false },
    remote: { type: "boolean", default: false },
    "persist-to": { type: "string" },
    "user-id": { type: "string" },
    email: { type: "string" },
    yes: { type: "boolean", default: false },
  },
});

if (args.local === args.remote) {
  fail("--local か --remote のどちらか一方を指定してください");
}
if (!args["user-id"] || !ID_PATTERN.test(args["user-id"])) {
  fail("--user-id にユーザーの ID を指定してください");
}
if (!args.email?.includes("@")) {
  fail("--email にメールアドレスを指定してください");
}

const execute = createExecutor({
  local: args.local,
  persistTo: args["persist-to"],
});

type UserRow = { id: string; name: string; email: string | null };

const userId = args["user-id"];
const email = normalizeEmail(args.email);

const [user] = execute<UserRow>(
  `SELECT id, name, email FROM users WHERE id = ${quote(userId)} LIMIT 1`,
);
if (!user) {
  fail(`ユーザー ${userId} が見つかりません`);
}
if (user.email === email) {
  console.log(
    `ユーザー ${user.name}（${user.id}）にはこのメールアドレスが設定されています`,
  );
  process.exit(0);
}
const [other] = execute<UserRow>(
  `SELECT id, name, email FROM users WHERE email = ${quote(email)} LIMIT 1`,
);
if (other) {
  fail(
    `このメールアドレスはすでに別のユーザー ${other.name}（${other.id}）に設定されています`,
  );
}

console.log(
  `対象のデータベース: ${args.local ? "ローカル" : "本番（remote）"}`,
);
console.log(`ユーザー: ${user.name}（${user.id}）`);
console.log(
  user.email
    ? "設定されているメールアドレスを置き換える"
    : "メールアドレスを新しく設定する",
);

if (args.remote && !args.yes) {
  await confirmOrExit();
}

execute(
  `UPDATE users SET email = ${quote(email)}, updated_at = unixepoch() WHERE id = ${quote(user.id)}`,
);
console.log("メールアドレスを設定しました");
