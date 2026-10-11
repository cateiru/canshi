// 既存のユーザーに、ログインに使うメールアドレス（のハッシュ）を紐付けるスクリプト。
//
// Cloudflare Access の OIDC でのログインを導入する前から使っていたユーザーは、メールアドレスの
// ハッシュ（users.email_hash）を持たない。そのままログインすると、同じ人でも別の新しいユーザーが
// 作られてしまうため、導入前にこのスクリプトで紐付ける（docs/deploy.md 参照）。
// メールアドレスそのものは保存せず、アプリと同じ方法（`src/features/auth/emailHash.ts`）で
// ハッシュにした値だけを保存する。
//
// 使い方:
//   EMAIL_HASH_SALT=<本番と同じ SALT> pnpm user:link-email --remote --user-id <id> --email <メールアドレス> [--yes]
//   pnpm user:link-email --local [--persist-to ./.wrangler/state] --user-id <id> --email <メールアドレス>
//
// - SALT は環境変数 `EMAIL_HASH_SALT` から読む。本番（`wrangler secret put EMAIL_HASH_SALT`）と
//   違う値にすると、ログインしても一致しない。`--local` で未設定なら開発用の SALT を使う
// - 別のユーザーがすでに同じメールアドレスで登録されている場合は、何もせずにエラーにする
// - `--remote` では実行前に確認する。`--yes` で確認を省略できる
import { parseArgs } from "node:util";
import { getEmailHashSalt, hashEmail } from "../src/features/auth/emailHash.ts";
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

let salt: string;
try {
  salt = getEmailHashSalt(process.env.EMAIL_HASH_SALT, {
    allowDevelopmentSalt: args.local,
  });
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

const execute = createExecutor({
  local: args.local,
  persistTo: args["persist-to"],
});

type UserRow = { id: string; name: string; email_hash: string | null };

const userId = args["user-id"];
const emailHash = hashEmail(args.email, salt);

const [user] = execute<UserRow>(
  `SELECT id, name, email_hash FROM users WHERE id = ${quote(userId)} LIMIT 1`,
);
if (!user) {
  fail(`ユーザー ${userId} が見つかりません`);
}
if (user.email_hash === emailHash) {
  console.log(
    `ユーザー ${user.name}（${user.id}）にはこのメールアドレスが紐付いています`,
  );
  process.exit(0);
}
const [other] = execute<UserRow>(
  `SELECT id, name, email_hash FROM users WHERE email_hash = ${quote(emailHash)} LIMIT 1`,
);
if (other) {
  fail(
    `このメールアドレスはすでに別のユーザー ${other.name}（${other.id}）に紐付いています`,
  );
}

console.log(
  `対象のデータベース: ${args.local ? "ローカル" : "本番（remote）"}`,
);
console.log(`ユーザー: ${user.name}（${user.id}）`);
console.log(
  user.email_hash
    ? "紐付いているメールアドレスを置き換える"
    : "メールアドレスを新しく紐付ける",
);

if (args.remote && !args.yes) {
  await confirmOrExit();
}

execute(
  `UPDATE users SET email_hash = ${quote(emailHash)}, updated_at = unixepoch() WHERE id = ${quote(user.id)}`,
);
console.log("メールアドレスを紐付けました");
