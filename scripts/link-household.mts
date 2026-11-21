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
//   pnpm household:link --local  [--persist-to ./.wrangler/state] [--user-id <id> | --email <メールアドレス>] [--name <家の名前>]
//   pnpm household:link --remote [--user-id <id> | --email <メールアドレス>] [--name <家の名前>] [--yes]
//
// - `--user-id` で ID を、`--email` でログインに使うメールアドレスを指定してユーザーを選ぶ。
//   `--email` は `users.email` から探す
// - どちらも省略すると、最初に登録されたユーザーを使う
// - ユーザーがすでに家に所属している場合は新しく作らず、その家に猫を紐付ける（何度実行しても同じ結果になる）
// - `--remote` では実行前に確認する。`--yes` で確認を省略できる
import { randomUUID } from "node:crypto";
import { parseArgs } from "node:util";
import { asc, eq, isNull, sql } from "drizzle-orm";
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

const {
  cats,
  expenseRecords,
  feedingPresets,
  foodProducts,
  householdMembers,
  households,
  pushSubscriptions,
  users,
} = schema;

const DEFAULT_HOUSEHOLD_NAME = "わが家";

const { values: args } = parseArgs({
  options: {
    local: { type: "boolean", default: false },
    remote: { type: "boolean", default: false },
    "persist-to": { type: "string" },
    "user-id": { type: "string" },
    email: { type: "string" },
    name: { type: "string", default: DEFAULT_HOUSEHOLD_NAME },
    yes: { type: "boolean", default: false },
  },
});

function findUser(db: ScriptDb) {
  const query = db
    .select({ id: users.id, name: users.name })
    .from(users)
    .limit(1);
  if (args["user-id"]) {
    return query.where(eq(users.id, args["user-id"]));
  }
  if (args.email) {
    return query.where(eq(users.email, normalizeEmail(args.email)));
  }
  return query.orderBy(asc(users.createdAt), asc(users.id));
}

await runScript(async () => {
  if (args.local === args.remote) {
    fail("--local か --remote のどちらか一方を指定してください");
  }
  if (args["user-id"] && args.email) {
    fail("--user-id と --email は同時に指定できません");
  }
  if (args["user-id"] && !ID_PATTERN.test(args["user-id"])) {
    fail("--user-id の形式が正しくありません");
  }
  const householdName = args.name.trim();
  if (!householdName) {
    fail("--name に家の名前を指定してください");
  }

  const { db, close } = await openDatabase({
    local: args.local,
    persistTo: args["persist-to"],
  });
  try {
    const [user] = await findUser(db);
    if (!user) {
      fail(
        args["user-id"]
          ? `ユーザー ${args["user-id"]} が見つかりません`
          : args.email
            ? "このメールアドレスのユーザーが見つかりません。先にアプリの /login でログインしてください"
            : "ユーザーがいません。先にアプリの /login でログインしてユーザーを作成してください",
      );
    }

    const [
      [membership],
      orphanCount,
      orphanExpenseCount,
      orphanFoodProductCount,
      orphanFeedingPresetCount,
      orphanSubscriptionCount,
    ] = await Promise.all([
      db
        .select({ id: households.id, name: households.name })
        .from(householdMembers)
        .innerJoin(households, eq(households.id, householdMembers.householdId))
        .where(eq(householdMembers.userId, user.id))
        .orderBy(asc(householdMembers.createdAt), asc(households.id))
        .limit(1),
      db.$count(cats, isNull(cats.householdId)),
      db.$count(expenseRecords, isNull(expenseRecords.householdId)),
      db.$count(foodProducts, isNull(foodProducts.householdId)),
      db.$count(feedingPresets, isNull(feedingPresets.householdId)),
      db.$count(pushSubscriptions, isNull(pushSubscriptions.userId)),
    ]);

    console.log(
      `対象のデータベース: ${args.local ? "ローカル" : "本番（remote）"}`,
    );
    console.log(`ユーザー: ${user.name}（${user.id}）`);
    console.log(
      membership
        ? `家: ${membership.name}（${membership.id}、作成済み）`
        : `家: ${householdName}（新しく作成し、このユーザーをオーナーにする）`,
    );
    console.log(`家に紐付ける猫: ${orphanCount} 匹`);
    console.log(`家に紐付ける支出記録: ${orphanExpenseCount} 件`);
    console.log(`家に紐付けるごはん商品: ${orphanFoodProductCount} 件`);
    console.log(`家に紐付けるごはんプリセット: ${orphanFeedingPresetCount} 件`);
    console.log(
      `ユーザーに紐付ける Push 通知の購読: ${orphanSubscriptionCount} 件`,
    );

    if (args.remote && !args.yes && !(await confirm())) {
      console.log("中止しました");
      return;
    }

    let householdId = membership?.id;
    if (!householdId) {
      householdId = randomUUID();
      await db.batch([
        db.insert(households).values({ id: householdId, name: householdName }),
        db
          .insert(householdMembers)
          .values({ householdId, userId: user.id, role: "owner" }),
      ]);
      console.log(`家を作成しました（${householdId}）`);
    }

    // プリセットの明細は同じ家の商品に限るため、商品とプリセットは同じ家にまとめて紐付ける。
    // 途中で失敗して一部だけが紐付かないよう、すべての紐付けを 1 つの batch（トランザクション）で行う
    await db.batch([
      db
        .update(cats)
        .set({ householdId, updatedAt: sql`(unixepoch())` })
        .where(isNull(cats.householdId)),
      db
        .update(expenseRecords)
        .set({ householdId, updatedAt: sql`(unixepoch())` })
        .where(isNull(expenseRecords.householdId)),
      db
        .update(foodProducts)
        .set({ householdId, updatedAt: sql`(unixepoch())` })
        .where(isNull(foodProducts.householdId)),
      db
        .update(feedingPresets)
        .set({ householdId, updatedAt: sql`(unixepoch())` })
        .where(isNull(feedingPresets.householdId)),
      db
        .update(pushSubscriptions)
        .set({ userId: user.id })
        .where(isNull(pushSubscriptions.userId)),
    ]);
    const linkedCount = await db.$count(
      cats,
      eq(cats.householdId, householdId),
    );
    console.log(
      `家に未所属だった猫を紐付けました（この家の猫: ${linkedCount} 匹）`,
    );
    console.log("家に未所属だった支出記録を紐付けました");
    console.log("家に未所属だったごはん商品・ごはんプリセットを紐付けました");
    console.log("ユーザーに未紐付けだった Push 通知の購読を紐付けました");
  } finally {
    await close();
  }
});
