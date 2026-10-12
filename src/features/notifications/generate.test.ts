// @vitest-environment node
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { getDb } from "@/db/client";
import {
  cats,
  feedingRecords,
  feedingSchedules,
  households,
  notifications,
  symptoms,
} from "@/db/schema";

// `queries.test.ts` と同様に、`generate.ts` などが呼ぶ `getDb` 自体をこのテスト用の db に差し替える
let db: ReturnType<typeof getDb>;
vi.mock("@/db/client", () => ({
  getDb: () => db,
}));

const { generateNotifications, insertSymptomOngoingNotification } =
  await import("./generate");

/**
 * 症状の確認通知（`symptom_ongoing`）について、`generateNotifications` が DB から集める
 * 「未対応の通知があるか」「最後に対応した日時」が判定に正しく反映されることを、
 * `now` を制御して検証する
 */
describe("generateNotifications（症状の確認通知）", () => {
  beforeAll(async () => {
    const SQL = await initSqlJs();
    db = drizzle(new SQL.Database()) as unknown as ReturnType<typeof getDb>;
    await migrate(db as unknown as ReturnType<typeof drizzle>, {
      migrationsFolder: "./drizzle",
    });
  });

  async function listSymptomNotifications(symptomId: string) {
    return db
      .select()
      .from(notifications)
      .where(eq(notifications.referenceId, symptomId));
  }

  it("未対応の間は積み重ならず、対応した日から1ヶ月後に再び生成する", async () => {
    // 誕生日などの通知が混ざらないよう、生年月日は未設定にする
    const [cat] = await db
      .insert(cats)
      .values({ name: "たま", sex: "female" })
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

    // JST 2026-09-01 18:00。発症からちょうど1ヶ月
    await generateNotifications(new Date("2026-09-01T09:00:00.000Z"));
    const first = await listSymptomNotifications(symptom.id);
    expect(first).toHaveLength(1);
    expect(first[0].kind).toBe("symptom_ongoing");
    expect(first[0].title).toBe("たまの「くしゃみ」は解消しましたか？");

    // 対応しないまま2ヶ月目を迎えても、2件目は生成しない
    await generateNotifications(new Date("2026-10-02T09:00:00.000Z"));
    expect(await listSymptomNotifications(symptom.id)).toHaveLength(1);

    // JST 2026-10-02 に「まだ続いている」と答えた
    await db
      .update(notifications)
      .set({
        status: "done",
        updatedAt: new Date("2026-10-02T10:00:00.000Z"),
      })
      .where(eq(notifications.id, first[0].id));

    // 答えた直後や1ヶ月経つ前は生成しない
    await generateNotifications(new Date("2026-10-02T11:00:00.000Z"));
    await generateNotifications(new Date("2026-11-01T09:00:00.000Z"));
    expect(await listSymptomNotifications(symptom.id)).toHaveLength(1);

    // 答えた日から1ヶ月後に再び生成する
    await generateNotifications(new Date("2026-11-02T09:00:00.000Z"));
    const second = await listSymptomNotifications(symptom.id);
    expect(second).toHaveLength(2);
    expect(second.map((n) => n.status).sort()).toEqual(["done", "pending"]);
  });

  it("解消済みの症状は生成しない", async () => {
    const [cat] = await db
      .insert(cats)
      .values({ name: "みけ", sex: "male" })
      .returning();
    const [symptom] = await db
      .insert(symptoms)
      .values({
        catId: cat.id,
        symptomType: "咳",
        onsetAt: new Date("2026-06-01T09:00:00.000Z"),
        status: "resolved",
      })
      .returning();

    await generateNotifications(new Date("2026-09-01T09:00:00.000Z"));
    expect(await listSymptomNotifications(symptom.id)).toHaveLength(0);
  });
});

/**
 * 症状を読んでから通知を INSERT するまでの間に、別のリクエストで症状が解消・削除された
 * 場合を、判定済みの候補を直接 INSERT することで再現する
 */
describe("insertSymptomOngoingNotification", () => {
  async function setup(status: "ongoing" | "resolved") {
    const [cat] = await db
      .insert(cats)
      .values({ name: "くろ", sex: "male" })
      .returning();
    const [symptom] = await db
      .insert(symptoms)
      .values({
        catId: cat.id,
        symptomType: "くしゃみ",
        onsetAt: new Date("2026-08-01T09:00:00.000Z"),
        status,
      })
      .returning();
    const candidate = {
      catId: cat.id,
      kind: "symptom_ongoing" as const,
      referenceId: symptom.id,
      dedupeKey: `${cat.id}:symptom_ongoing:${symptom.id}:2026-08-01`,
      dueAt: new Date("2026-09-01T00:00:00.000Z"),
      symptomId: symptom.id,
      symptomType: "くしゃみ",
      status: "ongoing" as const,
      elapsedMonths: 1,
    };
    const message = {
      title: "くろの「くしゃみ」は解消しましたか？",
      body: "「くしゃみ」の症状が「継続中」のまま1ヶ月が経過しました",
      url: `/cats/${cat.id}/symptoms/${symptom.id}/edit`,
    };
    return { cat, symptom, candidate, message };
  }

  async function listByReference(referenceId: string) {
    return db
      .select()
      .from(notifications)
      .where(eq(notifications.referenceId, referenceId));
  }

  it("症状が未解消なら、候補どおりの内容で未対応の通知を作る", async () => {
    const { cat, symptom, candidate, message } = await setup("ongoing");

    await insertSymptomOngoingNotification(db, candidate, message);
    // 同じ dedupe_key では二重に作られない
    await insertSymptomOngoingNotification(db, candidate, message);

    const rows = await listByReference(symptom.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      catId: cat.id,
      kind: "symptom_ongoing",
      dedupeKey: candidate.dedupeKey,
      title: message.title,
      body: message.body,
      url: message.url,
      dueAt: candidate.dueAt,
      status: "pending",
      snoozedUntil: null,
      readAt: null,
      pushedAt: null,
    });
  });

  it("判定後に症状が解消されていれば、通知を作らない", async () => {
    const { symptom, candidate, message } = await setup("resolved");

    await insertSymptomOngoingNotification(db, candidate, message);

    expect(await listByReference(symptom.id)).toHaveLength(0);
  });

  it("判定後に症状が削除されていれば、通知を作らない", async () => {
    const { symptom, candidate, message } = await setup("ongoing");
    await db.delete(symptoms).where(eq(symptoms.id, symptom.id));

    await insertSymptomOngoingNotification(db, candidate, message);

    expect(await listByReference(symptom.id)).toHaveLength(0);
  });
});

/**
 * ごはんの時間の通知（`feeding_time`・`feeding_not_recorded`）について、家のごはんの時間と
 * 家の猫のごはん記録が判定に反映され、猫ごとではなく家に 1 件だけ生成されることを検証する
 */
describe("generateNotifications（ごはんの時間）", () => {
  async function listFeedingNotifications(householdId: string) {
    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.householdId, householdId));
    return rows.map((row) => row.kind).sort();
  }

  async function setupHousehold(name: string, catNames: string[]) {
    const [household] = await db
      .insert(households)
      .values({ name })
      .returning();
    const householdCats =
      catNames.length === 0
        ? []
        : await db
            .insert(cats)
            .values(
              catNames.map((catName) => ({
                name: catName,
                sex: "female" as const,
                householdId: household.id,
              })),
            )
            .returning();
    await db.insert(feedingSchedules).values([
      { householdId: household.id, time: "07:00" },
      { householdId: household.id, time: "19:00" },
    ]);
    return { household, householdCats };
  }

  it("猫が何匹いても家に 1 件だけ通知し、どの猫の記録もなければリマインダーを出す", async () => {
    const { household } = await setupHousehold("ごはんの家", [
      "しろ",
      "ちゃい",
    ]);

    // JST 2026-09-21 07:00
    await generateNotifications(new Date("2026-09-20T22:00:00.000Z"));
    expect(await listFeedingNotifications(household.id)).toEqual([
      "feeding_time",
    ]);

    // JST 13:00（07:00 と 19:00 の中間）
    await generateNotifications(new Date("2026-09-21T04:00:00.000Z"));
    expect(await listFeedingNotifications(household.id)).toEqual([
      "feeding_not_recorded",
      "feeding_time",
    ]);

    const [reminder] = await db
      .select()
      .from(notifications)
      .where(eq(notifications.kind, "feeding_not_recorded"));
    expect(reminder).toMatchObject({
      catId: null,
      householdId: household.id,
      title: "ごはんはあげましたか？",
      body: "07:00のごはんの記録がありません。あげていたら記録しておきましょう",
      url: "/cats",
    });

    // 同じ時刻に何度呼んでも重複して生成しない
    await generateNotifications(new Date("2026-09-21T04:00:00.000Z"));
    expect(await listFeedingNotifications(household.id)).toEqual([
      "feeding_not_recorded",
      "feeding_time",
    ]);
  });

  it("家のどれかの猫に記録があればリマインダーを出さない。猫が 1 匹なら、その猫の記録画面へ遷移する", async () => {
    const { household, householdCats } = await setupHousehold("1匹の家", [
      "みけ",
    ]);
    const [cat] = householdCats;

    // JST 2026-09-22 07:00
    await generateNotifications(new Date("2026-09-21T22:00:00.000Z"));
    const [timeNotification] = await db
      .select()
      .from(notifications)
      .where(eq(notifications.householdId, household.id));
    expect(timeNotification).toMatchObject({
      kind: "feeding_time",
      title: "ごはんの時間です",
      url: `/cats/${cat.id}/feeding-records/new`,
    });

    // JST 07:30 に記録した（naive UTC）
    await db.insert(feedingRecords).values({
      catId: cat.id,
      occurredAt: new Date("2026-09-22T07:30:00.000Z"),
    });

    // JST 13:00
    await generateNotifications(new Date("2026-09-22T04:00:00.000Z"));
    expect(await listFeedingNotifications(household.id)).toEqual([
      "feeding_time",
    ]);
  });

  it("猫のいない家には通知しない", async () => {
    const { household } = await setupHousehold("猫のいない家", []);

    // JST 2026-09-23 07:00
    await generateNotifications(new Date("2026-09-22T22:00:00.000Z"));
    expect(await listFeedingNotifications(household.id)).toEqual([]);
  });
});
