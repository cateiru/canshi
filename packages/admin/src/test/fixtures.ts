import type { Database } from "sql.js";

/** テスト用のデータ（unix 秒の日時は 2026-10-01 00:00:00 UTC を基準にする） */
export const BASE_TIME = 1_790_812_800;

export function seed(db: Database) {
  db.run(
    `INSERT INTO users (id, name, role, created_at, updated_at) VALUES
      ('user-1', 'たろう', 'admin', ${BASE_TIME}, ${BASE_TIME}),
      ('user-2', '<script>alert(1)</script>', 'member', ${BASE_TIME + 60}, ${BASE_TIME + 60}),
      ('user-3', 'はなこ', 'member', ${BASE_TIME + 120}, ${BASE_TIME + 120})`,
  );
  db.run(
    `INSERT INTO households (id, name, created_at, updated_at) VALUES
      ('household-1', 'わが家', ${BASE_TIME}, ${BASE_TIME}),
      ('household-2', '実家', ${BASE_TIME + 60}, ${BASE_TIME + 60})`,
  );
  db.run(
    `INSERT INTO household_members (household_id, user_id, role, created_at) VALUES
      ('household-1', 'user-2', 'member', ${BASE_TIME + 60}),
      ('household-1', 'user-1', 'owner', ${BASE_TIME}),
      ('household-2', 'user-1', 'owner', ${BASE_TIME + 60})`,
  );
  db.run(
    `INSERT INTO cats (id, household_id, name, sex) VALUES
      ('cat-1', 'household-1', 'みけ', 'female'),
      ('cat-2', 'household-1', 'くろ', 'male'),
      ('cat-3', NULL, 'しろ', 'unknown')`,
  );
  db.run(
    `INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES
      ('hash-active-1', 'user-1', ${BASE_TIME + 86_400}, ${BASE_TIME}),
      ('hash-active-2', 'user-1', ${BASE_TIME + 172_800}, ${BASE_TIME}),
      ('hash-expired', 'user-1', ${BASE_TIME - 1}, ${BASE_TIME - 100}),
      ('hash-expired-2', 'user-3', ${BASE_TIME - 1}, ${BASE_TIME - 100})`,
  );
}
