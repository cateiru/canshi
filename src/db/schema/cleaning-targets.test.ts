// @vitest-environment node
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { beforeAll, describe, expect, it } from "vitest";
import { cats } from "./cats";
import { cleaningTargets } from "./cleaning-targets";

describe("cleaning_targets テーブル", () => {
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

    await db.insert(cleaningTargets).values({
      catId: cat.id,
      name: "猫砂",
      frequencyValue: 7,
      frequencyUnit: "days",
    });

    const rows = await db.select().from(cleaningTargets);

    expect(rows).toHaveLength(1);
    expect(rows[0].catId).toBe(cat.id);
    expect(rows[0].isActive).toBe(true);
  });

  it("frequencyUnit を省略すると days になる", async () => {
    const [cat] = await db
      .insert(cats)
      .values({ name: "みけ", sex: "male" })
      .returning();

    await db.insert(cleaningTargets).values({
      catId: cat.id,
      name: "フィルター",
      frequencyValue: 2,
    });

    const rows = await db
      .select()
      .from(cleaningTargets)
      .where(eq(cleaningTargets.catId, cat.id));

    expect(rows[0].frequencyUnit).toBe("days");
  });
});
