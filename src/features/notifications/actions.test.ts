// @vitest-environment node
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { getDb } from "@/db/client";
import {
  cats,
  cleaningRecords,
  cleaningTargets,
  householdMembers,
  households,
  notifications,
  pushDeliveries,
  pushSubscriptions,
  symptoms,
  users,
} from "@/db/schema";
import { getNaiveUtcNow } from "@/features/shared/datetime";

// sql.js は D1 と同じ SQLite 方言のテスト用スタブだが `db.batch`（D1 専用）を持たないため、
// 順番に実行するだけの簡易実装をこのテストで補う。D1 の batch は 1 トランザクションとして
// 実行され他の batch と混ざらないため、同時に呼ばれた batch も1つずつ直列に実行する。`queries.test.ts` と同様に
// `@/db/client` の `getDb` 自体をこのテスト用の db に差し替える
let db: ReturnType<typeof getDb>;
vi.mock("@/db/client", () => ({
  getDb: () => db,
}));
// ログイン中のユーザーは常に user-1（household-1 のメンバー）とする
vi.mock("@/features/auth/session", () => ({
  requireUser: async () => ({ id: "user-1" }),
}));

const {
  markCleaningNotificationDoneAction,
  resolveSymptomNotificationAction,
  snoozeNotificationAction,
} = await import("./actions");

beforeAll(async () => {
  const SQL = await initSqlJs();
  const raw = drizzle(new SQL.Database());
  await migrate(raw, { migrationsFolder: "./drizzle" });
  db = raw as unknown as ReturnType<typeof getDb>;
  await db.insert(users).values([
    { id: "user-1", name: "管理者" },
    { id: "user-2", name: "別の家の人" },
  ]);
  await db.insert(households).values([
    { id: "household-1", name: "わが家", ownerUserId: "user-1" },
    { id: "household-2", name: "別の家", ownerUserId: "user-2" },
  ]);
  await db.insert(householdMembers).values([
    { householdId: "household-1", userId: "user-1" },
    { householdId: "household-2", userId: "user-2" },
  ]);
  let batchQueue: Promise<unknown> = Promise.resolve();
  // biome-ignore lint/suspicious/noExplicitAny: テスト用に D1 の batch を簡易実装する
  (db as any).batch = (statements: PromiseLike<unknown>[]) => {
    const run = batchQueue.then(async () => {
      const results: unknown[] = [];
      for (const statement of statements) {
        results.push(await statement);
      }
      return results;
    });
    batchQueue = run.catch(() => {});
    return run;
  };
});

describe("snoozeNotificationAction", () => {
  it("別の家の猫の通知は延期できない", async () => {
    const [cat] = await db
      .insert(cats)
      .values({ name: "クロ", sex: "male", householdId: "household-2" })
      .returning();
    const [notification] = await db
      .insert(notifications)
      .values({
        catId: cat.id,
        kind: "weight_measurement",
        dedupeKey: `dedupe-${crypto.randomUUID()}`,
        title: "クロの体重測定のお願い",
        body: "そろそろ体重を測りましょう",
        url: `/cats/${cat.id}`,
        dueAt: new Date(),
      })
      .returning();

    const result = await snoozeNotificationAction(
      notification.id,
      new Date("2026-09-20T00:00:00.000Z"),
    );

    expect(result).toEqual({ error: "通知が見つかりませんでした" });
    const [unchanged] = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, notification.id));
    expect(unchanged.status).toBe("pending");
  });

  it("延期すると status・snoozedUntil を更新し、readAt・pushedAt と push_deliveries の記録をリセットする", async () => {
    const [cat] = await db
      .insert(cats)
      .values({ name: "たま", sex: "female", householdId: "household-1" })
      .returning();
    const [notification] = await db
      .insert(notifications)
      .values({
        catId: cat.id,
        kind: "weight_measurement",
        dedupeKey: `dedupe-${crypto.randomUUID()}`,
        title: "たまの体重測定のお願い",
        body: "そろそろ体重を測りましょう",
        url: `/cats/${cat.id}`,
        dueAt: new Date(),
        // 表示済み・Push送信済みの状態から延期する
        readAt: new Date(),
        pushedAt: new Date(),
      })
      .returning();
    const [subscription] = await db
      .insert(pushSubscriptions)
      .values({
        endpoint: `https://push.example.com/${crypto.randomUUID()}`,
        p256dh: "p256dh-key",
        auth: "auth-secret",
      })
      .returning();
    // 延期前に1回送信済みだったという記録
    await db.insert(pushDeliveries).values({
      notificationId: notification.id,
      subscriptionId: subscription.id,
    });

    const snoozedUntil = new Date("2026-09-20T00:00:00.000Z");
    const result = await snoozeNotificationAction(
      notification.id,
      snoozedUntil,
    );

    expect(result).toEqual({});

    const [updated] = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, notification.id));
    expect(updated.status).toBe("snoozed");
    expect(updated.snoozedUntil).toEqual(snoozedUntil);
    expect(updated.readAt).toBeNull();
    expect(updated.pushedAt).toBeNull();

    // push_deliveries の記録が残っていると、期日到来後も Workflow がこの購読への
    // 送信を「済み」と判断して再送しない（src/workflows/notification.ts の `delivered` 参照）
    const deliveries = await db
      .select()
      .from(pushDeliveries)
      .where(eq(pushDeliveries.notificationId, notification.id));
    expect(deliveries).toHaveLength(0);
  });
});

describe("markCleaningNotificationDoneAction", () => {
  async function setup(targetValues: { isActive?: boolean } = {}) {
    const [cat] = await db
      .insert(cats)
      .values({ name: "たま", sex: "female", householdId: "household-1" })
      .returning();
    const [target] = await db
      .insert(cleaningTargets)
      .values({
        catId: cat.id,
        name: "トイレ",
        frequencyValue: 1,
        ...targetValues,
      })
      .returning();
    const [notification] = await db
      .insert(notifications)
      .values({
        catId: cat.id,
        kind: "cleaning_due",
        referenceId: target.id,
        dedupeKey: `dedupe-${crypto.randomUUID()}`,
        title: "トイレのお手入れの時期です",
        body: "たまのトイレが予定日を迎えました",
        url: `/cats/${cat.id}/cleaning/targets/${target.id}/records`,
        dueAt: new Date(),
      })
      .returning();
    return { cat, target, notification };
  }

  async function findNotification(id: string) {
    const [notification] = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, id));
    return notification;
  }

  async function findRecords(targetId: string) {
    return db
      .select()
      .from(cleaningRecords)
      .where(eq(cleaningRecords.cleaningTargetId, targetId));
  }

  it("通知を完了にし、掃除対象に今の時刻の記録を追加する", async () => {
    const { cat, target, notification } = await setup();

    // performed_at は秒単位で保存されるため、前後を秒に丸めて範囲を確認する
    const before = Math.floor(getNaiveUtcNow().getTime() / 1000) * 1000;
    const result = await markCleaningNotificationDoneAction(notification.id);
    const after = getNaiveUtcNow().getTime();

    expect(result).toEqual({});
    expect((await findNotification(notification.id)).status).toBe("done");
    const records = await findRecords(target.id);
    expect(records).toHaveLength(1);
    expect(records[0].catId).toBe(cat.id);
    expect(records[0].memo).toBeNull();
    expect(records[0].performedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(records[0].performedAt.getTime()).toBeLessThanOrEqual(after);
  });

  it("完了済みの通知に対しては記録を追加しない", async () => {
    const { target, notification } = await setup();

    await markCleaningNotificationDoneAction(notification.id);
    const result = await markCleaningNotificationDoneAction(notification.id);

    expect(result).toEqual({});
    expect(await findRecords(target.id)).toHaveLength(1);
  });

  it("同じ通知を同時に完了しても記録は1件だけ追加する", async () => {
    const { target, notification } = await setup();

    const results = await Promise.all([
      markCleaningNotificationDoneAction(notification.id),
      markCleaningNotificationDoneAction(notification.id),
    ]);

    expect(results).toEqual([{}, {}]);
    expect((await findNotification(notification.id)).status).toBe("done");
    expect(await findRecords(target.id)).toHaveLength(1);
  });

  it("掃除対象が無効化されていればエラーを返し、通知も完了にしない", async () => {
    const { target, notification } = await setup({ isActive: false });

    const result = await markCleaningNotificationDoneAction(notification.id);

    expect(result).toEqual({
      error:
        "掃除対象が無効になっているため記録できません。「無視する」で通知を閉じてください",
    });
    expect((await findNotification(notification.id)).status).toBe("pending");
    expect(await findRecords(target.id)).toHaveLength(0);
  });

  it("掃除以外の通知にはエラーを返す", async () => {
    const [cat] = await db
      .insert(cats)
      .values({ name: "たま", sex: "female", householdId: "household-1" })
      .returning();
    const [notification] = await db
      .insert(notifications)
      .values({
        catId: cat.id,
        kind: "weight_measurement",
        dedupeKey: `dedupe-${crypto.randomUUID()}`,
        title: "たまの体重測定のお願い",
        body: "そろそろ体重を測りましょう",
        url: `/cats/${cat.id}`,
        dueAt: new Date(),
      })
      .returning();

    const result = await markCleaningNotificationDoneAction(notification.id);

    expect(result).toEqual({ error: "通知が見つかりませんでした" });
    expect((await findNotification(notification.id)).status).toBe("pending");
  });
});

describe("resolveSymptomNotificationAction", () => {
  async function setup() {
    const [cat] = await db
      .insert(cats)
      .values({ name: "たま", sex: "female", householdId: "household-1" })
      .returning();
    const [symptom] = await db
      .insert(symptoms)
      .values({
        catId: cat.id,
        symptomType: "くしゃみ",
        onsetAt: new Date("2026-08-01T09:00:00.000Z"),
        status: "ongoing",
      })
      .returning();
    const [notification] = await db
      .insert(notifications)
      .values({
        catId: cat.id,
        kind: "symptom_ongoing",
        referenceId: symptom.id,
        dedupeKey: `dedupe-${crypto.randomUUID()}`,
        title: "たまの「くしゃみ」は解消しましたか？",
        body: "「くしゃみ」の症状が「継続中」のまま1ヶ月が経過しました",
        url: `/cats/${cat.id}/symptoms/${symptom.id}/edit`,
        dueAt: new Date(),
      })
      .returning();
    return { cat, symptom, notification };
  }

  it("通知を完了にし、症状記録を解消にする", async () => {
    const { symptom, notification } = await setup();

    const result = await resolveSymptomNotificationAction(notification.id);

    expect(result).toEqual({});
    const [updatedNotification] = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, notification.id));
    expect(updatedNotification.status).toBe("done");
    const [updatedSymptom] = await db
      .select()
      .from(symptoms)
      .where(eq(symptoms.id, symptom.id));
    expect(updatedSymptom.status).toBe("resolved");
  });

  it("症状の確認通知でなければエラーを返し、何も更新しない", async () => {
    const { cat } = await setup();
    const [other] = await db
      .insert(notifications)
      .values({
        catId: cat.id,
        kind: "weight_measurement",
        dedupeKey: `dedupe-${crypto.randomUUID()}`,
        title: "たまの体重測定のお願い",
        body: "前回の体重測定から14日が経過しました",
        url: `/cats/${cat.id}/weight-records`,
        dueAt: new Date(),
      })
      .returning();

    const result = await resolveSymptomNotificationAction(other.id);

    expect(result.error).toBeDefined();
    const [unchanged] = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, other.id));
    expect(unchanged.status).toBe("pending");
  });

  it("別の猫の症状を指している通知では症状を更新しない", async () => {
    const { symptom } = await setup();
    const [otherCat] = await db
      .insert(cats)
      .values({ name: "みけ", sex: "male", householdId: "household-1" })
      .returning();
    const [notification] = await db
      .insert(notifications)
      .values({
        catId: otherCat.id,
        kind: "symptom_ongoing",
        referenceId: symptom.id,
        dedupeKey: `dedupe-${crypto.randomUUID()}`,
        title: "みけの「くしゃみ」は解消しましたか？",
        body: "「くしゃみ」の症状が「継続中」のまま1ヶ月が経過しました",
        url: `/cats/${otherCat.id}/symptoms/${symptom.id}/edit`,
        dueAt: new Date(),
      })
      .returning();

    const result = await resolveSymptomNotificationAction(notification.id);

    expect(result.error).toBeDefined();
    const [unchanged] = await db
      .select()
      .from(symptoms)
      .where(eq(symptoms.id, symptom.id));
    expect(unchanged.status).toBe("ongoing");
  });
});
