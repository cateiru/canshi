// @vitest-environment node
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { beforeEach, describe, expect, it } from "vitest";
import { cats } from "./cats";
import { households } from "./households";
import { memoLabels, memoRecordLabels } from "./memo-labels";
import { memoRecords } from "./memo-records";

describe("memo_labels・memo_record_labels テーブル", () => {
  let db: ReturnType<typeof drizzle>;

  beforeEach(async () => {
    const SQL = await initSqlJs();
    db = drizzle(new SQL.Database());
    await migrate(db, { migrationsFolder: "./drizzle" });
    await db.insert(households).values([
      { id: "house-1", name: "家1" },
      { id: "house-2", name: "家2" },
    ]);
  });

  it("1 つのメモに複数のラベルを付けられる", async () => {
    const [cat] = await db
      .insert(cats)
      .values({ name: "たま", sex: "female", householdId: "house-1" })
      .returning();
    const [memo] = await db
      .insert(memoRecords)
      .values({ catId: cat.id, content: "爪を切った" })
      .returning();
    const labels = await db
      .insert(memoLabels)
      .values([
        { householdId: "house-1", name: "お手入れ", color: "blue" },
        { householdId: "house-1", name: "大事", color: "red" },
      ])
      .returning();
    const links = labels.map((label) => ({
      memoRecordId: memo.id,
      memoLabelId: label.id,
    }));

    await db.insert(memoRecordLabels).values(links);

    expect(await db.select().from(memoRecordLabels)).toEqual(links);
  });

  it("同じ家に同じ名前のラベルは作れず、別の家には作れる", async () => {
    await db
      .insert(memoLabels)
      .values({ householdId: "house-1", name: "病院", color: "red" });

    await expect(
      db
        .insert(memoLabels)
        .values({ householdId: "house-1", name: "病院", color: "blue" }),
    ).rejects.toThrow();
    await db
      .insert(memoLabels)
      .values({ householdId: "house-2", name: "病院", color: "blue" });

    expect(await db.select().from(memoLabels)).toHaveLength(2);
  });
});
