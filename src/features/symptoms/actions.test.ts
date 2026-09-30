// @vitest-environment node
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { getDb } from "@/db/client";
import { cats, notifications, symptoms } from "@/db/schema";

// `src/features/notifications/actions.test.ts` と同様に、`getDb` をテスト用の sql.js に差し替え、
// D1 専用の `db.batch` は順番に実行するだけの簡易実装で補う。写真・動画の同期（R2）と
// リダイレクトはこのテストの対象外のため何もしないものに差し替える
let db: ReturnType<typeof getDb>;
vi.mock("@/db/client", () => ({
  getDb: () => db,
}));
vi.mock("@/features/media/attach", () => ({
  syncRecordMediaFromForm: async () => undefined,
}));
vi.mock("@/features/media/storage", () => ({
  deleteMediaAssetsByRecord: async () => {},
}));
vi.mock("next/navigation", () => ({
  redirect: () => {},
}));

const { deleteSymptomAction, updateSymptomAction } = await import("./actions");

beforeAll(async () => {
  const SQL = await initSqlJs();
  const raw = drizzle(new SQL.Database());
  await migrate(raw, { migrationsFolder: "./drizzle" });
  db = raw as unknown as ReturnType<typeof getDb>;
  // biome-ignore lint/suspicious/noExplicitAny: テスト用に D1 の batch を簡易実装する
  (db as any).batch = async (statements: PromiseLike<unknown>[]) => {
    const results: unknown[] = [];
    for (const statement of statements) {
      results.push(await statement);
    }
    return results;
  };
});

async function setup() {
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

function makeFormData(status: string) {
  const formData = new FormData();
  formData.set("symptomType", "くしゃみ");
  formData.set("onsetDate", "2026-08-01");
  formData.set("onsetTime", "09:00");
  formData.set("status", status);
  return formData;
}

async function findNotification(id: string) {
  const [notification] = await db
    .select()
    .from(notifications)
    .where(eq(notifications.id, id));
  return notification;
}

describe("updateSymptomAction", () => {
  it("解消にすると、未対応の確認通知を完了にする", async () => {
    const { cat, symptom, notification } = await setup();

    const result = await updateSymptomAction(
      cat.id,
      symptom.id,
      {},
      makeFormData("resolved"),
    );

    expect(result.savedRecordId).toBe(symptom.id);
    expect((await findNotification(notification.id)).status).toBe("done");
  });

  it("解消以外の状態で保存しても、確認通知はそのまま残す", async () => {
    const { cat, symptom, notification } = await setup();

    await updateSymptomAction(
      cat.id,
      symptom.id,
      {},
      makeFormData("improving"),
    );

    expect((await findNotification(notification.id)).status).toBe("pending");
  });
});

describe("deleteSymptomAction", () => {
  it("症状を削除すると、その症状の確認通知も削除する", async () => {
    const { cat, symptom, notification } = await setup();

    await deleteSymptomAction(cat.id, symptom.id);

    expect(await findNotification(notification.id)).toBeUndefined();
    const [deleted] = await db
      .select()
      .from(symptoms)
      .where(eq(symptoms.id, symptom.id));
    expect(deleted).toBeUndefined();
  });
});
