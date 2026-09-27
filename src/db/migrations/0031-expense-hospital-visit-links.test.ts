// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import initSqlJs, { type Database } from "sql.js";
import { beforeAll, describe, expect, it } from "vitest";

const MIGRATIONS_DIR = path.resolve("drizzle");
const TARGET_TAG = "0031_zippy_leopardon";

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
 * 支出記録と通院記録の紐付けを expense_records.hospital_visit_id から中間テーブル
 * （expense_record_hospital_visits）へ移すマイグレーションで、既存の紐付けと
 * 支出記録・猫との紐付けが失われないことを確認する
 */
describe(`${TARGET_TAG}（支出記録と通院記録の紐付けの中間テーブル化）`, () => {
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
      INSERT INTO hospital_visits (id, cat_id, visited_at, reason)
        VALUES ('visit-1', 'cat-1', 1789466400, '健診');
      INSERT INTO expense_records (id, spent_at, amount_yen, category, hospital_visit_id, memo)
        VALUES
          ('expense-linked', 1789430400, 5500, 'hospital', 'visit-1', '健診代'),
          ('expense-plain', 1789430400, 1280, 'food', NULL, NULL);
      INSERT INTO expense_record_cats (expense_record_id, cat_id)
        VALUES ('expense-linked', 'cat-1'), ('expense-plain', 'cat-1');
    `);

    // D1 と同じく外部キー制約を有効にし、マイグレーションを 1 つのトランザクションで適用する。
    // D1 はトランザクション中の `PRAGMA foreign_keys=OFF` を無視するため、テーブルの作り直しは
    // `PRAGMA defer_foreign_keys` でコミット時まで制約の検査を遅らせて行う
    sqlite.run("PRAGMA foreign_keys = ON");
    sqlite.run("BEGIN");
    runMigration(sqlite, TARGET_TAG);
    sqlite.run("COMMIT");
  });

  it("既存の紐付けを中間テーブルへ移す", () => {
    expect(
      selectRows(
        sqlite,
        "SELECT expense_record_id, hospital_visit_id FROM expense_record_hospital_visits",
      ),
    ).toEqual([
      { expense_record_id: "expense-linked", hospital_visit_id: "visit-1" },
    ]);
  });

  it("支出記録と猫との紐付けは残る", () => {
    expect(
      selectRows(
        sqlite,
        "SELECT id, amount_yen, category, memo FROM expense_records ORDER BY id",
      ),
    ).toEqual([
      {
        id: "expense-linked",
        amount_yen: 5500,
        category: "hospital",
        memo: "健診代",
      },
      { id: "expense-plain", amount_yen: 1280, category: "food", memo: null },
    ]);
    expect(
      selectRows(
        sqlite,
        "SELECT expense_record_id FROM expense_record_cats ORDER BY expense_record_id",
      ),
    ).toEqual([
      { expense_record_id: "expense-linked" },
      { expense_record_id: "expense-plain" },
    ]);
    expect(selectRows(sqlite, "PRAGMA foreign_key_check")).toEqual([]);
  });

  it("expense_records から hospital_visit_id 列を削除する", () => {
    const columns = selectRows(
      sqlite,
      "PRAGMA table_info(expense_records)",
    ).map((row) => row.name);
    expect(columns).not.toContain("hospital_visit_id");
  });
});
