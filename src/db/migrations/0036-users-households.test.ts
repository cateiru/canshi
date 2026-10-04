// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import initSqlJs, { type Database } from "sql.js";
import { beforeAll, describe, expect, it } from "vitest";

const MIGRATIONS_DIR = path.resolve("drizzle");
const TARGET_TAG = "0036_acoustic_the_leader";

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
 * ユーザー・家を追加し、猫に家（household_id）を持たせるマイグレーションで、
 * cats を作り直さずに既存の猫と記録が残り、家に未所属（NULL）になることを確認する。
 * 既存の猫は `scripts/link-household.mjs` で家に紐付ける
 */
describe(`${TARGET_TAG}（ユーザーと家）`, () => {
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
      INSERT INTO poop_records (id, cat_id, occurred_at, consistency)
        VALUES ('poop-1', 'cat-1', 1789466400, 'normal');
    `);

    // D1 と同じく外部キー制約を有効にし、マイグレーションを 1 つのトランザクションで適用する
    sqlite.run("PRAGMA foreign_keys = ON");
    sqlite.run("BEGIN");
    runMigration(sqlite, TARGET_TAG);
    sqlite.run("COMMIT");
  });

  it("既存の猫と記録は残り、家には未所属になる", () => {
    expect(
      selectRows(sqlite, "SELECT id, name, household_id FROM cats"),
    ).toEqual([{ id: "cat-1", name: "たま", household_id: null }]);
    expect(selectRows(sqlite, "SELECT id, cat_id FROM poop_records")).toEqual([
      { id: "poop-1", cat_id: "cat-1" },
    ]);
    expect(selectRows(sqlite, "PRAGMA foreign_key_check")).toEqual([]);
  });

  it("ユーザー・家を作って既存の猫を紐付けられる", () => {
    sqlite.run(`
      INSERT INTO users (id, name, role) VALUES ('user-1', '管理者', 'admin');
      INSERT INTO households (id, name, owner_user_id) VALUES ('household-1', 'わが家', 'user-1');
      INSERT INTO household_members (household_id, user_id) VALUES ('household-1', 'user-1');
      UPDATE cats SET household_id = 'household-1' WHERE household_id IS NULL;
    `);

    expect(selectRows(sqlite, "SELECT id, household_id FROM cats")).toEqual([
      { id: "cat-1", household_id: "household-1" },
    ]);
    expect(selectRows(sqlite, "PRAGMA foreign_key_check")).toEqual([]);
  });

  it("存在しない家・ユーザーは参照できない", () => {
    expect(() =>
      sqlite.run("UPDATE cats SET household_id = 'missing' WHERE id = 'cat-1'"),
    ).toThrow();
    expect(() =>
      sqlite.run(
        "INSERT INTO household_members (household_id, user_id) VALUES ('household-1', 'missing')",
      ),
    ).toThrow();
  });
});
