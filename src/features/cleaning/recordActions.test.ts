// @vitest-environment node
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { getDb } from "@/db/client";
import {
  cats,
  cleaningRecords,
  cleaningTargets,
  type NotificationStatus,
  notifications,
} from "@/db/schema";

// `src/features/feeding-records/actions.test.ts` と同様に、`getDb` をテスト用の sql.js に
// 差し替え、D1 専用の `db.batch` は順番に実行するだけの簡易実装で補う
let db: ReturnType<typeof getDb>;
vi.mock("@/db/client", () => ({
  getDb: () => db,
}));
// Next.js の redirect と同じく例外を投げ、以降の処理を止める
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
// 猫の家による認可はこのテストの対象外のため、常に許可する
vi.mock("@/features/auth/session", () => ({
  requireCatAccess: async (catId: string) => {
    const [cat] = await db.select().from(cats).where(eq(cats.id, catId));
    return { cat };
  },
}));

const {
  createCleaningRecordAction,
  quickCreateCleaningRecordAction,
  updateCleaningRecordAction,
} = await import("./recordActions");

beforeEach(async () => {
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

  // 日本時間 2026-09-21 07:30
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-20T22:30:00.000Z"));

  await db.insert(cats).values([
    { id: "tama", name: "たま", sex: "female" },
    { id: "kuro", name: "クロ", sex: "male" },
  ]);
  await db.insert(cleaningTargets).values([
    { id: "toilet", catId: "tama", name: "トイレ", frequencyValue: 7 },
    { id: "bowl", catId: "tama", name: "食器", frequencyValue: 7 },
    { id: "kuro-toilet", catId: "kuro", name: "トイレ", frequencyValue: 7 },
  ]);
});

afterEach(() => {
  vi.useRealTimers();
});

async function addNotification(
  id: string,
  catId: string,
  referenceId: string,
  options: {
    kind?: "cleaning_due" | "shampoo_elapsed";
    status?: NotificationStatus;
    dueAt?: Date;
  } = {},
) {
  await db.insert(notifications).values({
    id,
    catId,
    kind: options.kind ?? "cleaning_due",
    referenceId,
    dedupeKey: id,
    title: "タイトル",
    body: "本文",
    url: "/",
    // 予定日 2026-09-21（予定日を UTC 0 時にしたもの）
    dueAt: options.dueAt ?? new Date("2026-09-21T00:00:00.000Z"),
    status: options.status ?? "pending",
  });
}

async function statusOf(id: string) {
  const [row] = await db
    .select({ status: notifications.status })
    .from(notifications)
    .where(eq(notifications.id, id));
  return row.status;
}

function recordForm(performedDate: string, performedTime: string) {
  const formData = new FormData();
  formData.set("performedDate", performedDate);
  formData.set("performedTime", performedTime);
  formData.set("memo", "");
  return formData;
}

describe("createCleaningRecordAction の掃除の通知", () => {
  it("記録した掃除対象の未対応の通知だけを完了にする", async () => {
    await addNotification("toilet", "tama", "toilet");
    await addNotification("toilet-snoozed", "tama", "toilet", {
      status: "snoozed",
      // 前の予定日のまま残っている通知
      dueAt: new Date("2026-09-14T00:00:00.000Z"),
    });
    await addNotification("toilet-dismissed", "tama", "toilet", {
      status: "dismissed",
    });
    await addNotification("bowl", "tama", "bowl");
    await addNotification("kuro-toilet", "kuro", "kuro-toilet");
    await addNotification("shampoo", "tama", "toilet", {
      kind: "shampoo_elapsed",
    });

    const result = await createCleaningRecordAction(
      "tama",
      "toilet",
      {},
      recordForm("2026-09-21", "07:30"),
    );
    expect(result).toEqual({
      redirectTo: "/cats/tama/cleaning/targets/toilet/records",
    });

    expect(await statusOf("toilet")).toBe("done");
    expect(await statusOf("toilet-snoozed")).toBe("done");
    // 対応済みの通知・ほかの掃除対象・ほかの猫・ほかの種類の通知はそのまま
    expect(await statusOf("toilet-dismissed")).toBe("dismissed");
    expect(await statusOf("bowl")).toBe("pending");
    expect(await statusOf("kuro-toilet")).toBe("pending");
    expect(await statusOf("shampoo")).toBe("pending");
  });

  it("予定日より前でも、次回予定日が通知の予定日を過ぎる日時の記録なら完了にする", async () => {
    await addNotification("toilet", "tama", "toilet");

    // 前日に掃除したことを記録すると、次回予定日は 2026-09-27 になる
    await createCleaningRecordAction(
      "tama",
      "toilet",
      {},
      recordForm("2026-09-20", "20:00"),
    );

    expect(await statusOf("toilet")).toBe("done");
  });

  it("さかのぼった記録で、次回予定日が通知の予定日を過ぎないなら完了にしない", async () => {
    await addNotification("toilet", "tama", "toilet");

    // 2026-09-14 の記録から数えた次回予定日は、通知と同じ 2026-09-21
    await createCleaningRecordAction(
      "tama",
      "toilet",
      {},
      recordForm("2026-09-14", "09:00"),
    );

    expect(await statusOf("toilet")).toBe("pending");
  });

  it("先の日時で入力した記録では完了にしない", async () => {
    await addNotification("toilet", "tama", "toilet");

    // 日本時間 07:30 に、08:00 の記録を入力する
    await createCleaningRecordAction(
      "tama",
      "toilet",
      {},
      recordForm("2026-09-21", "08:00"),
    );

    expect(await statusOf("toilet")).toBe("pending");
  });

  it("無効化した掃除対象には記録せず、通知も完了にしない", async () => {
    await db
      .update(cleaningTargets)
      .set({ isActive: false })
      .where(eq(cleaningTargets.id, "toilet"));
    await addNotification("toilet", "tama", "toilet");

    const result = await createCleaningRecordAction(
      "tama",
      "toilet",
      {},
      recordForm("2026-09-21", "07:30"),
    );
    expect(result).toEqual({ formError: "掃除対象が見つかりませんでした" });

    expect(await db.select().from(cleaningRecords)).toEqual([]);
    expect(await statusOf("toilet")).toBe("pending");
  });
});

describe("quickCreateCleaningRecordAction の掃除の通知", () => {
  it("今すぐ掃除したと記録したら通知を完了にする", async () => {
    await addNotification("toilet", "tama", "toilet");

    await expect(
      quickCreateCleaningRecordAction("tama", "toilet", new FormData()),
    ).rejects.toThrow("REDIRECT:/cats/tama/cleaning");

    const records = await db.select().from(cleaningRecords);
    expect(records).toHaveLength(1);
    // 日本時間の時計の数字のまま保存する（naive UTC）
    expect(records[0].performedAt).toEqual(
      new Date("2026-09-21T07:30:00.000Z"),
    );
    expect(await statusOf("toilet")).toBe("done");
  });
});

describe("updateCleaningRecordAction の掃除の通知", () => {
  beforeEach(async () => {
    await addNotification("toilet", "tama", "toilet");
  });

  it("実施日時を先の日時から今以前に直したら完了にする", async () => {
    await db.insert(cleaningRecords).values({
      id: "record",
      catId: "tama",
      cleaningTargetId: "toilet",
      performedAt: new Date("2026-09-21T08:00:00.000Z"),
    });

    const result = await updateCleaningRecordAction(
      "tama",
      "toilet",
      "record",
      {},
      recordForm("2026-09-21", "07:30"),
    );
    expect(result).toEqual({
      redirectTo: "/cats/tama/cleaning/targets/toilet/records",
    });

    expect(await statusOf("toilet")).toBe("done");
  });

  it("実施日時を変えずにメモだけを直しても完了にしない", async () => {
    await db.insert(cleaningRecords).values({
      id: "record",
      catId: "tama",
      cleaningTargetId: "toilet",
      performedAt: new Date("2026-09-21T07:00:00.000Z"),
    });

    const formData = recordForm("2026-09-21", "07:00");
    formData.set("memo", "念入りに");
    await updateCleaningRecordAction("tama", "toilet", "record", {}, formData);

    expect(await statusOf("toilet")).toBe("pending");
  });

  it("別の猫の記録 ID を渡しても、記録も通知も更新しない", async () => {
    await db.insert(cleaningRecords).values({
      id: "kuro-record",
      catId: "kuro",
      cleaningTargetId: "kuro-toilet",
      performedAt: new Date("2026-09-21T08:00:00.000Z"),
    });

    const result = await updateCleaningRecordAction(
      "tama",
      "toilet",
      "kuro-record",
      {},
      recordForm("2026-09-21", "07:30"),
    );
    expect(result).toEqual({ formError: "記録が見つかりませんでした" });

    expect(await statusOf("toilet")).toBe("pending");
  });
});
