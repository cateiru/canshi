// @vitest-environment node
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { getDb } from "@/db/client";
import { cats, mediaAssets, poopRecords, weightRecords } from "@/db/schema";
import { POOP_RECORD_MEDIA_TYPE } from "@/features/poop-records/media";
import { listTimelineForMonth, type TimelineEntry } from "./queries";

function expectWeightRecord(entry: TimelineEntry) {
  if (entry.type !== "weight") {
    throw new Error(`expected a "weight" entry, got "${entry.type}"`);
  }
  return entry.record;
}

// PR35 で `listTimelineForMonth` に `d1` 引数を追加した（Service Bindings
// 経由の呼び出しに対応するため）。既存の Server Component からの呼び出し
// （`d1` を渡さない）を壊していないことを、この回帰テストで確認する
let db: ReturnType<typeof getDb>;
vi.mock("@/db/client", () => ({
  getDb: () => db,
}));

describe("listTimelineForMonth", () => {
  beforeAll(async () => {
    const SQL = await initSqlJs();
    db = drizzle(new SQL.Database()) as unknown as ReturnType<typeof getDb>;
    await migrate(db as unknown as ReturnType<typeof drizzle>, {
      migrationsFolder: "./drizzle",
    });
  });

  it("種別をまたいで発生日時の降順にマージし、メディアも引き当てる", async () => {
    const [cat] = await db
      .insert(cats)
      .values({ name: "たま", sex: "female" })
      .returning();

    const [poop] = await db
      .insert(poopRecords)
      .values({
        catId: cat.id,
        occurredAt: new Date("2026-05-10T00:00:00.000Z"),
        consistency: "normal",
      })
      .returning();
    const [media] = await db
      .insert(mediaAssets)
      .values({
        recordType: POOP_RECORD_MEDIA_TYPE,
        recordId: poop.id,
        objectKey: "poop/1.jpg",
        mimeType: "image/jpeg",
      })
      .returning();

    await db.insert(weightRecords).values({
      catId: cat.id,
      occurredAt: new Date("2026-05-15T00:00:00.000Z"),
      inputMethod: "direct",
      catWeightKg: 4.2,
    });

    // 対象月の範囲外（4月）は含まれないことも合わせて確認する
    await db.insert(weightRecords).values({
      catId: cat.id,
      occurredAt: new Date("2026-04-30T00:00:00.000Z"),
      inputMethod: "direct",
      catWeightKg: 4.1,
    });

    const result = await listTimelineForMonth(cat.id, 2026, 5);

    expect(result.entries.map((e) => e.type)).toEqual(["weight", "poop"]);
    expect(result.hasMore).toBe(false);
    expect(result.entries[1].media).toHaveLength(1);
    expect(result.entries[1].media[0].id).toBe(media.id);
  });

  it("pageSize を超える件数は hasMore と page で正しく分割される", async () => {
    const [cat] = await db
      .insert(cats)
      .values({ name: "みけ", sex: "male" })
      .returning();

    for (let day = 1; day <= 3; day++) {
      await db.insert(weightRecords).values({
        catId: cat.id,
        occurredAt: new Date(`2026-06-0${day}T00:00:00.000Z`),
        inputMethod: "direct",
        catWeightKg: 3 + day,
      });
    }

    const firstPage = await listTimelineForMonth(cat.id, 2026, 6, {
      pageSize: 2,
      page: 1,
    });
    expect(firstPage.entries).toHaveLength(2);
    expect(firstPage.hasMore).toBe(true);
    // 降順のため最初のページは 6/3, 6/2
    expect(expectWeightRecord(firstPage.entries[0]).catWeightKg).toBeCloseTo(6);

    const secondPage = await listTimelineForMonth(cat.id, 2026, 6, {
      pageSize: 2,
      page: 2,
    });
    expect(secondPage.entries).toHaveLength(1);
    expect(secondPage.hasMore).toBe(false);
    expect(expectWeightRecord(secondPage.entries[0]).catWeightKg).toBeCloseTo(
      4,
    );
  });

  it("date で指定した日だけに一覧を絞り込める", async () => {
    const [cat] = await db
      .insert(cats)
      .values({ name: "くろ", sex: "unknown" })
      .returning();

    await db.insert(weightRecords).values({
      catId: cat.id,
      occurredAt: new Date("2026-07-10T00:00:00.000Z"),
      inputMethod: "direct",
      catWeightKg: 3.5,
    });
    await db.insert(weightRecords).values({
      catId: cat.id,
      occurredAt: new Date("2026-07-11T00:00:00.000Z"),
      inputMethod: "direct",
      catWeightKg: 3.6,
    });

    const result = await listTimelineForMonth(cat.id, 2026, 7, {
      date: "2026-07-10",
    });

    expect(result.entries).toHaveLength(1);
    expect(expectWeightRecord(result.entries[0]).catWeightKg).toBeCloseTo(3.5);
    // datesByDay は絞り込みの影響を受けず月全体を反映する
    expect(result.datesByDay.has("2026-07-11")).toBe(true);
  });
});
