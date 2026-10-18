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

const {
  generateNotifications,
  insertHouseholdNotification,
  insertSymptomOngoingNotification,
} = await import("./generate");

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

    // JST 08:00（07:00 の 1 時間後）
    await generateNotifications(new Date("2026-09-20T23:00:00.000Z"));
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
      url: `/households/${household.id}/feeding-records/new`,
    });

    // 同じ時刻に何度呼んでも重複して生成しない
    await generateNotifications(new Date("2026-09-20T23:00:00.000Z"));
    expect(await listFeedingNotifications(household.id)).toEqual([
      "feeding_not_recorded",
      "feeding_time",
    ]);
  });

  it("家のどれかの猫に記録があればリマインダーを出さない", async () => {
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
      url: `/households/${household.id}/feeding-records/new`,
    });

    // JST 07:30 に記録した（naive UTC）
    await db.insert(feedingRecords).values({
      catId: cat.id,
      occurredAt: new Date("2026-09-22T07:30:00.000Z"),
    });

    // JST 08:00
    await generateNotifications(new Date("2026-09-21T23:00:00.000Z"));
    expect(await listFeedingNotifications(household.id)).toEqual([
      "feeding_time",
    ]);
  });

  it("スケジュール実行の予定時刻より後に記録されていれば、遅れて実行してもリマインダーを出さない", async () => {
    const { household, householdCats } = await setupHousehold("遅れの家", [
      "くろ",
    ]);
    const [cat] = householdCats;
    // JST 2026-09-26 08:05 に記録した。08:00 の実行のステップが遅れ・再試行で、その後に進む
    await db.insert(feedingRecords).values({
      catId: cat.id,
      occurredAt: new Date("2026-09-26T08:05:00.000Z"),
    });

    // JST 08:00 の予定時刻で判定する（判定では 08:05 の記録はまだ先の記録として数えない）
    await generateNotifications(new Date("2026-09-25T23:00:00.000Z"));
    expect(await listFeedingNotifications(household.id)).toEqual([]);
  });

  it("猫のいない家には通知しない", async () => {
    const { household } = await setupHousehold("猫のいない家", []);

    // JST 2026-09-23 07:00
    await generateNotifications(new Date("2026-09-22T22:00:00.000Z"));
    expect(await listFeedingNotifications(household.id)).toEqual([]);
  });
});

/**
 * 記録を読んでから通知を INSERT するまでの間に、別のリクエストでごはんが記録されたり、
 * ごはんの時間が削除・オフにされたりした場合を、判定済みの候補を直接 INSERT することで再現する
 */
describe("insertHouseholdNotification", () => {
  async function setup() {
    const [household] = await db
      .insert(households)
      .values({ name: "確認の家" })
      .returning();
    const [cat] = await db
      .insert(cats)
      .values({ name: "はな", sex: "female", householdId: household.id })
      .returning();
    const [schedule] = await db
      .insert(feedingSchedules)
      .values({ householdId: household.id, time: "07:00" })
      .returning();
    const candidate = {
      householdId: household.id,
      kind: "feeding_not_recorded" as const,
      referenceId: schedule.id,
      dedupeKey: `household:${household.id}:feeding_not_recorded:${schedule.id}:2026-09-25`,
      dueAt: new Date("2026-09-25T07:00:00.000Z"),
      time: "07:00",
      recordWindow: {
        start: new Date("2026-09-24T19:00:00.000Z"),
        end: new Date("2026-09-25T19:00:00.000Z"),
      },
    };
    const message = {
      title: "ごはんはあげましたか？",
      body: "07:00のごはんの記録がありません。あげていたら記録しておきましょう",
      url: `/cats/${cat.id}/feeding-records/new`,
    };
    return { household, cat, schedule, candidate, message };
  }

  async function listByHousehold(householdId: string) {
    return db
      .select()
      .from(notifications)
      .where(eq(notifications.householdId, householdId));
  }

  it("条件を満たしていれば、家についての通知を作る", async () => {
    const { household, schedule, candidate, message } = await setup();
    // 範囲の終わりちょうどの記録は、範囲外として扱う
    const [otherCat] = await db
      .insert(cats)
      .values({ name: "そら", sex: "male", householdId: household.id })
      .returning();
    await db.insert(feedingRecords).values({
      catId: otherCat.id,
      occurredAt: candidate.recordWindow.end,
    });

    await insertHouseholdNotification(db, candidate, message);
    // 同じ dedupe_key では二重に作られない
    await insertHouseholdNotification(db, candidate, message);

    const rows = await listByHousehold(household.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      catId: null,
      householdId: household.id,
      kind: "feeding_not_recorded",
      referenceId: schedule.id,
      title: message.title,
      url: message.url,
      dueAt: candidate.dueAt,
      status: "pending",
      pushedAt: null,
    });
  });

  it("判定後に家の猫のごはんが記録されていれば、通知を作らない", async () => {
    const { household, cat, candidate, message } = await setup();
    await db.insert(feedingRecords).values({
      catId: cat.id,
      occurredAt: new Date("2026-09-25T08:00:00.000Z"),
    });

    await insertHouseholdNotification(db, candidate, message);

    expect(await listByHousehold(household.id)).toEqual([]);
  });

  it("判定した時刻より後でも、INSERT するまでに記録されていれば通知を作らない", async () => {
    // JST 08:00 に判定したリマインダーを、ステップの遅れ・再試行で JST 08:10 に INSERT する
    const { household, cat, candidate, message } = await setup();
    await db.insert(feedingRecords).values({
      catId: cat.id,
      occurredAt: new Date("2026-09-25T08:05:00.000Z"),
    });

    await insertHouseholdNotification(
      db,
      candidate,
      message,
      new Date("2026-09-24T23:10:00.000Z"),
    );

    expect(await listByHousehold(household.id)).toEqual([]);
  });

  it("INSERT する時点より後の記録（先の日時で入力されたもの）では、通知を止めない", async () => {
    const { household, cat, candidate, message } = await setup();
    await db.insert(feedingRecords).values({
      catId: cat.id,
      occurredAt: new Date("2026-09-25T09:00:00.000Z"),
    });

    // JST 08:10 に INSERT する。09:00 の記録はまだあげていない
    await insertHouseholdNotification(
      db,
      candidate,
      message,
      new Date("2026-09-24T23:10:00.000Z"),
    );

    expect(await listByHousehold(household.id)).toHaveLength(1);
  });

  it("判定後にごはんの時間が削除・オフにされていれば、通知を作らない", async () => {
    const deleted = await setup();
    await db
      .delete(feedingSchedules)
      .where(eq(feedingSchedules.id, deleted.schedule.id));
    await insertHouseholdNotification(db, deleted.candidate, deleted.message);
    expect(await listByHousehold(deleted.household.id)).toEqual([]);

    const disabled = await setup();
    await db
      .update(feedingSchedules)
      .set({ remindIfNotRecorded: false })
      .where(eq(feedingSchedules.id, disabled.schedule.id));
    await insertHouseholdNotification(db, disabled.candidate, disabled.message);
    expect(await listByHousehold(disabled.household.id)).toEqual([]);
  });

  it("判定後に家の最後の猫が削除・引っ越しされていれば、通知を作らない", async () => {
    const { household, cat, candidate, message } = await setup();
    const [otherHousehold] = await db
      .insert(households)
      .values({ name: "引っ越し先の家" })
      .returning();
    await db
      .update(cats)
      .set({ householdId: otherHousehold.id })
      .where(eq(cats.id, cat.id));

    await insertHouseholdNotification(db, candidate, message);

    expect(await listByHousehold(household.id)).toEqual([]);
  });
});
