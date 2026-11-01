// @vitest-environment node
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { beforeAll, describe, expect, it } from "vitest";
import { brushingRecords } from "./brushing-records";
import { cats } from "./cats";

describe("brushing_records テーブル", () => {
  let db: ReturnType<typeof drizzle>;

  beforeAll(async () => {
    const SQL = await initSqlJs();
    const sqlite = new SQL.Database();
    db = drizzle(sqlite);
    await migrate(db, { migrationsFolder: "./drizzle" });
  });

  it("cat への参照つきで型安全に insert / select できる", async () => {
    const [cat] = await db
      .insert(cats)
      .values({ name: "たま", sex: "female" })
      .returning();

    await db.insert(brushingRecords).values({
      catId: cat.id,
      performedAt: new Date("2026-11-01T21:00:00.000Z"),
      durationMinutes: 10,
      shedAmount: "more",
      hasMats: true,
      memo: "お腹の毛玉をほぐした",
    });

    const rows = await db.select().from(brushingRecords);

    expect(rows).toHaveLength(1);
    expect(rows[0].catId).toBe(cat.id);
    expect(rows[0].durationMinutes).toBe(10);
    expect(rows[0].shedAmount).toBe("more");
    expect(rows[0].hasMats).toBe(true);
    // 指定しなかった真偽値は既定で false になる
    expect(rows[0].hasSkinIssue).toBe(false);
    expect(rows[0].memo).toBe("お腹の毛玉をほぐした");
  });
});
