// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import initSqlJs, { type Database } from "sql.js";
import { beforeAll, describe, expect, it } from "vitest";

const MIGRATIONS_DIR = path.resolve("drizzle");
const TARGET_TAG = "0035_flippant_catseye";

type Journal = { entries: { tag: string }[] };

function runMigration(sqlite: Database, tag: string) {
  const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, `${tag}.sql`), "utf8");
  for (const statement of sql.split("--> statement-breakpoint")) {
    if (statement.trim()) {
      sqlite.run(statement);
    }
  }
}

function selectRows(sqlite: Database, sql: string) {
  const [result] = sqlite.exec(sql);
  if (!result) {
    return [];
  }
  return result.values.map((values) =>
    Object.fromEntries(
      result.columns.map((column, index) => [column, values[index]]),
    ),
  );
}

/**
 * ごはん記録・プリセットに記録方法（mode）を追加し、明細のグラム単位の列を nullable にする
 * マイグレーションで、既存の記録・プリセットの値が失われず、厳格モードとして扱われることを確認する
 */
describe(`${TARGET_TAG}（ごはん記録のあいまいモード）`, () => {
  let sqlite: Database;

  beforeAll(async () => {
    const SQL = await initSqlJs();
    sqlite = new SQL.Database();
    const journal: Journal = JSON.parse(
      fs.readFileSync(path.join(MIGRATIONS_DIR, "meta/_journal.json"), "utf8"),
    );
    const targetIndex = journal.entries.findIndex(
      (entry) => entry.tag === TARGET_TAG,
    );
    for (const entry of journal.entries.slice(0, targetIndex)) {
      runMigration(sqlite, entry.tag);
    }

    sqlite.run(`
      INSERT INTO cats (id, name, sex) VALUES ('cat-1', 'たま', 'female');
      INSERT INTO food_products (id, name, kcal_per_100g, package_amount_g, nutrition_type, texture_type)
        VALUES ('food-1', 'カリカリ', 350, 1000, 'complete', 'dry');
      INSERT INTO feeding_records (id, cat_id, occurred_at)
        VALUES ('feeding-1', 'cat-1', 1789466400);
      INSERT INTO feeding_record_items
        (id, feeding_record_id, food_product_id, given_amount_g, leftover_amount_g, estimated_intake_g, estimated_kcal, sort_order)
        VALUES ('feeding-item-1', 'feeding-1', 'food-1', 50, 10, 40, 140, 0);
      INSERT INTO feeding_presets (id, name) VALUES ('preset-1', '朝ごはん');
      INSERT INTO feeding_preset_items (id, preset_id, food_product_id, given_amount_g, sort_order)
        VALUES ('preset-item-1', 'preset-1', 'food-1', 30, 0);
    `);

    // D1 と同じく外部キー制約を有効にし、マイグレーションを 1 つのトランザクションで適用する
    sqlite.run("PRAGMA foreign_keys = ON");
    sqlite.run("BEGIN");
    runMigration(sqlite, TARGET_TAG);
    sqlite.run("COMMIT");
  });

  it("既存のごはん記録は厳格モードになり、明細の値は残る", () => {
    expect(selectRows(sqlite, "SELECT id, mode FROM feeding_records")).toEqual([
      { id: "feeding-1", mode: "strict" },
    ]);
    expect(
      selectRows(
        sqlite,
        "SELECT id, feeding_record_id, given_amount_g, leftover_amount_g, estimated_intake_g, estimated_kcal, given_amount_level, leftover_level FROM feeding_record_items",
      ),
    ).toEqual([
      {
        id: "feeding-item-1",
        feeding_record_id: "feeding-1",
        given_amount_g: 50,
        leftover_amount_g: 10,
        estimated_intake_g: 40,
        estimated_kcal: 140,
        given_amount_level: null,
        leftover_level: null,
      },
    ]);
  });

  it("既存のプリセットは厳格モードになり、明細の値は残る", () => {
    expect(selectRows(sqlite, "SELECT id, mode FROM feeding_presets")).toEqual([
      { id: "preset-1", mode: "strict" },
    ]);
    expect(
      selectRows(
        sqlite,
        "SELECT id, preset_id, given_amount_g, given_amount_level FROM feeding_preset_items",
      ),
    ).toEqual([
      {
        id: "preset-item-1",
        preset_id: "preset-1",
        given_amount_g: 30,
        given_amount_level: null,
      },
    ]);
    expect(selectRows(sqlite, "PRAGMA foreign_key_check")).toEqual([]);
  });

  it("あいまいモードの明細はグラム単位の量を持たずに保存できる", () => {
    sqlite.run(`
      INSERT INTO feeding_records (id, cat_id, occurred_at, mode)
        VALUES ('feeding-2', 'cat-1', 1789470000, 'approximate');
      INSERT INTO feeding_record_items
        (id, feeding_record_id, food_product_id, given_amount_level, leftover_level, sort_order)
        VALUES ('feeding-item-2', 'feeding-2', 'food-1', 'normal', 'none', 0);
    `);
    expect(
      selectRows(
        sqlite,
        "SELECT given_amount_g, estimated_kcal, given_amount_level, leftover_level FROM feeding_record_items WHERE id = 'feeding-item-2'",
      ),
    ).toEqual([
      {
        given_amount_g: null,
        estimated_kcal: null,
        given_amount_level: "normal",
        leftover_level: "none",
      },
    ]);
  });
});
