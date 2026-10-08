// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import initSqlJs, { type Database } from "sql.js";
import { describe, expect, it } from "vitest";

const MIGRATIONS_DIR = path.resolve("drizzle");
const TARGET_TAG = "0039_sticky_masked_marvel";

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

/** 対象のマイグレーションの直前まで適用し、`seed` を投入してから対象を適用する */
async function migrateWith(seed: string) {
  const SQL = await initSqlJs();
  const sqlite = new SQL.Database();
  const journal: Journal = JSON.parse(
    fs.readFileSync(path.join(MIGRATIONS_DIR, "meta/_journal.json"), "utf8"),
  );
  const targetIndex = journal.entries.findIndex(
    (entry) => entry.tag === TARGET_TAG,
  );
  for (const entry of journal.entries.slice(0, targetIndex)) {
    runMigration(sqlite, entry.tag);
  }

  sqlite.run(seed);

  // D1 と同じく外部キー制約を有効にし、マイグレーションを 1 つのトランザクションで適用する
  sqlite.run("PRAGMA foreign_keys = ON");
  sqlite.run("BEGIN");
  runMigration(sqlite, TARGET_TAG);
  sqlite.run("COMMIT");
  return sqlite;
}

/**
 * 支出記録に家（household_id）を持たせるマイグレーションで、既存の支出記録が関連する猫の家に
 * 属し、別の家の猫・通院記録との紐付けが外れることを確認する
 */
describe(`${TARGET_TAG}（支出記録の家）`, () => {
  it("関連する猫の家に属させ、猫のいない支出は家が 1 つならその家に属させる", async () => {
    const sqlite = await migrateWith(`
      INSERT INTO households (id, name) VALUES ('household-1', 'わが家');
      INSERT INTO cats (id, household_id, name, sex)
        VALUES ('cat-1', 'household-1', 'たま', 'female');
      INSERT INTO expense_records (id, spent_at, amount_yen, category)
        VALUES
          ('expense-with-cat', 1789430400, 1280, 'food'),
          ('expense-without-cat', 1789430400, 500, 'other');
      INSERT INTO expense_record_cats (expense_record_id, cat_id)
        VALUES ('expense-with-cat', 'cat-1');
    `);

    expect(
      selectRows(
        sqlite,
        "SELECT id, household_id FROM expense_records ORDER BY id",
      ),
    ).toEqual([
      { id: "expense-with-cat", household_id: "household-1" },
      { id: "expense-without-cat", household_id: "household-1" },
    ]);
    expect(
      selectRows(
        sqlite,
        "SELECT expense_record_id, cat_id FROM expense_record_cats",
      ),
    ).toEqual([{ expense_record_id: "expense-with-cat", cat_id: "cat-1" }]);
    expect(selectRows(sqlite, "PRAGMA foreign_key_check")).toEqual([]);
  });

  it("家が複数あるときは最初に登録された猫の家に属させ、別の家の猫・通院記録との紐付けを外す", async () => {
    const sqlite = await migrateWith(`
      INSERT INTO households (id, name)
        VALUES ('household-1', 'わが家'), ('household-2', '実家');
      INSERT INTO cats (id, household_id, name, sex, created_at)
        VALUES
          ('cat-1', 'household-1', 'たま', 'female', 1700000000),
          ('cat-2', 'household-2', 'みけ', 'female', 1700000100);
      INSERT INTO hospital_visits (id, cat_id, visited_at, reason)
        VALUES
          ('visit-1', 'cat-1', 1789466400, '健診'),
          ('visit-2', 'cat-2', 1789466400, '健診');
      INSERT INTO expense_records (id, spent_at, amount_yen, category)
        VALUES
          ('expense-shared', 1789430400, 11000, 'hospital'),
          ('expense-without-cat', 1789430400, 500, 'other');
      INSERT INTO expense_record_cats (expense_record_id, cat_id)
        VALUES ('expense-shared', 'cat-1'), ('expense-shared', 'cat-2');
      INSERT INTO expense_record_hospital_visits (expense_record_id, hospital_visit_id)
        VALUES ('expense-shared', 'visit-1'), ('expense-shared', 'visit-2');
    `);

    expect(
      selectRows(
        sqlite,
        "SELECT id, household_id FROM expense_records ORDER BY id",
      ),
    ).toEqual([
      { id: "expense-shared", household_id: "household-1" },
      // 家を決められないため、家に未所属のまま残す
      { id: "expense-without-cat", household_id: null },
    ]);
    expect(
      selectRows(
        sqlite,
        "SELECT expense_record_id, cat_id FROM expense_record_cats",
      ),
    ).toEqual([{ expense_record_id: "expense-shared", cat_id: "cat-1" }]);
    expect(
      selectRows(
        sqlite,
        "SELECT expense_record_id, hospital_visit_id FROM expense_record_hospital_visits",
      ),
    ).toEqual([
      { expense_record_id: "expense-shared", hospital_visit_id: "visit-1" },
    ]);
    expect(selectRows(sqlite, "PRAGMA foreign_key_check")).toEqual([]);
  });

  it("家に未所属の猫だけに紐付く支出は、家が決まるまで紐付けを残す", async () => {
    const sqlite = await migrateWith(`
      INSERT INTO cats (id, name, sex) VALUES ('cat-1', 'たま', 'female');
      INSERT INTO expense_records (id, spent_at, amount_yen, category)
        VALUES ('expense-1', 1789430400, 1280, 'food');
      INSERT INTO expense_record_cats (expense_record_id, cat_id)
        VALUES ('expense-1', 'cat-1');
    `);

    expect(
      selectRows(sqlite, "SELECT id, household_id FROM expense_records"),
    ).toEqual([{ id: "expense-1", household_id: null }]);
    expect(
      selectRows(
        sqlite,
        "SELECT expense_record_id, cat_id FROM expense_record_cats",
      ),
    ).toEqual([{ expense_record_id: "expense-1", cat_id: "cat-1" }]);
  });
});
