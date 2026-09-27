// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import initSqlJs, { type Database } from "sql.js";
import { beforeAll, describe, expect, it } from "vitest";

const MIGRATIONS_DIR = path.resolve("drizzle");
const TARGET_TAG = "0030_furry_madripoor";

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
 * 写真記録（cat_photos）を廃止するマイグレーションで、プロフィールに使っていた写真が
 * 猫のプロフィール画像として残り、それ以外の写真が削除待ちの下書きになることを確認する
 */
describe(`${TARGET_TAG}（写真記録の廃止）`, () => {
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
      INSERT INTO cat_photos (id, cat_id, taken_at) VALUES ('photo-1', 'cat-1', 0);
      INSERT INTO media_assets (id, cat_id, record_type, record_id, object_key, mime_type, sort_order)
        VALUES
          ('asset-profile', 'cat-1', 'cat_photo', 'photo-1', 'cat_photo/photo-1/asset-profile', 'image/jpeg', 1),
          ('asset-other', 'cat-1', 'cat_photo', 'photo-1', 'cat_photo/photo-1/asset-other', 'image/jpeg', 0),
          ('asset-poop', 'cat-1', 'poop_record', 'poop-1', 'poop_record/poop-1/asset-poop', 'image/jpeg', 0);
      UPDATE cats SET profile_media_asset_id = 'asset-profile', is_profile_pinned = 1, profile_crop_x = 10 WHERE id = 'cat-1';
    `);

    runMigration(sqlite, TARGET_TAG);
  });

  it("プロフィールに使っていた写真は cat_profile として猫に紐付いたまま残る", () => {
    expect(
      selectRows(
        sqlite,
        "SELECT record_type, record_id, cat_id, sort_order FROM media_assets WHERE id = 'asset-profile'",
      ),
    ).toEqual([
      {
        record_type: "cat_profile",
        record_id: "cat-1",
        cat_id: "cat-1",
        sort_order: 0,
      },
    ]);
    expect(
      selectRows(
        sqlite,
        "SELECT profile_media_asset_id, profile_crop_x FROM cats WHERE id = 'cat-1'",
      ),
    ).toEqual([
      { profile_media_asset_id: "asset-profile", profile_crop_x: 10 },
    ]);
  });

  it("それ以外の写真は削除待ちの下書きになる", () => {
    expect(
      selectRows(
        sqlite,
        "SELECT record_type, record_id, cat_id FROM media_assets WHERE id = 'asset-other'",
      ),
    ).toEqual([
      { record_type: "pending", record_id: "asset-other", cat_id: null },
    ]);
  });

  it("他の記録の添付は変更しない", () => {
    expect(
      selectRows(
        sqlite,
        "SELECT record_type, record_id FROM media_assets WHERE id = 'asset-poop'",
      ),
    ).toEqual([{ record_type: "poop_record", record_id: "poop-1" }]);
  });

  it("cat_photos テーブルと is_profile_pinned 列を削除する", () => {
    expect(
      selectRows(
        sqlite,
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'cat_photos'",
      ),
    ).toEqual([]);
    const columns = selectRows(sqlite, "PRAGMA table_info(cats)").map(
      (row) => row.name,
    );
    expect(columns).not.toContain("is_profile_pinned");
  });
});
