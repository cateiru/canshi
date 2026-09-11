// @vitest-environment node
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { beforeAll, describe, expect, it } from "vitest";
import { cats } from "./cats";
import { waterRecords } from "./water-records";

describe("water_records テーブル", () => {
  let db: ReturnType<typeof drizzle>;

  beforeAll(async () => {
    const SQL = await initSqlJs();
    const sqlite = new SQL.Database();
    // D1 は外部キー制約を有効化した状態で動くため、sql.js でも同じ挙動になるよう揃える
    sqlite.run("PRAGMA foreign_keys = ON;");
    db = drizzle(sqlite);
    await migrate(db, { migrationsFolder: "./drizzle" });
  });

  it("cat への参照つきで型安全に insert / select できる", async () => {
    const [cat] = await db
      .insert(cats)
      .values({ name: "たま", sex: "female" })
      .returning();

    await db.insert(waterRecords).values({
      catId: cat.id,
      occurredAt: new Date("2026-09-07T08:00:00.000Z"),
      measurementMethod: "scale",
      suppliedAmountMl: 200,
      remainingAmountMl: 50,
      estimatedIntakeMl: 150,
      hasSpill: false,
      wasWaterChanged: true,
      subjectiveAmount: "usual",
    });

    const rows = await db.select().from(waterRecords);

    expect(rows).toHaveLength(1);
    expect(rows[0].catId).toBe(cat.id);
    expect(rows[0].estimatedIntakeMl).toBeCloseTo(150);
  });

  describe("猫削除時の外部キー制約", () => {
    it("water_records が残っていると猫の削除は外部キー制約で失敗する", async () => {
      const [cat] = await db
        .insert(cats)
        .values({ name: "みけ", sex: "male" })
        .returning();
      await db.insert(waterRecords).values({
        catId: cat.id,
        occurredAt: new Date("2026-09-07T08:00:00.000Z"),
        measurementMethod: "scale",
        suppliedAmountMl: 100,
      });

      await expect(
        db.delete(cats).where(eq(cats.id, cat.id)),
      ).rejects.toThrow();
    });

    it("water_records を先に削除すれば猫を削除できる", async () => {
      const [cat] = await db
        .insert(cats)
        .values({ name: "くろ", sex: "male" })
        .returning();
      await db.insert(waterRecords).values({
        catId: cat.id,
        occurredAt: new Date("2026-09-07T08:00:00.000Z"),
        measurementMethod: "scale",
        suppliedAmountMl: 100,
      });

      await db.delete(waterRecords).where(eq(waterRecords.catId, cat.id));
      await db.delete(cats).where(eq(cats.id, cat.id));

      const rows = await db.select().from(cats).where(eq(cats.id, cat.id));
      expect(rows).toHaveLength(0);
    });
  });
});
