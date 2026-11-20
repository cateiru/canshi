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
import { eq, sql } from "drizzle-orm";
import { normalizeEmail } from "../src/features/auth/domain/email.ts";
import {
  confirm,
  fail,
  ID_PATTERN,
  openDatabase,
  runScript,
  type ScriptDb,
  schema,
} from "./d1.mts";

const { users } = schema;

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

async function findUserBy(db: ScriptDb, column: "id" | "email", value: string) {
  const [user] = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users[column], value))
    .limit(1);
  return user;
}

await runScript(async () => {
  if (args.local === args.remote) {
    fail("--local か --remote のどちらか一方を指定してください");
  }
  const userId = args["user-id"];
  if (!userId || !ID_PATTERN.test(userId)) {
    fail("--user-id にユーザーの ID を指定してください");
  }
  if (!args.email?.includes("@")) {
    fail("--email にメールアドレスを指定してください");
  }
  const email = normalizeEmail(args.email);

  const { db, close } = await openDatabase({
    local: args.local,
    persistTo: args["persist-to"],
  });
  try {
    const user = await findUserBy(db, "id", userId);
    if (!user) {
      fail(`ユーザー ${userId} が見つかりません`);
    }
    if (user.email === email) {
      console.log(
        `ユーザー ${user.name}（${user.id}）にはこのメールアドレスが設定されています`,
      );
      return;
    }
    const other = await findUserBy(db, "email", email);
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

    if (args.remote && !args.yes && !(await confirm())) {
      console.log("中止しました");
      return;
    }

    await db
      .update(users)
      .set({ email, updatedAt: sql`(unixepoch())` })
      .where(eq(users.id, user.id));
    console.log("メールアドレスを設定しました");
  } finally {
    await close();
  }
});
