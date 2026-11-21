import type { Database } from "sql.js";

/** テスト用のデータ（unix 秒の日時は 2026-10-01 00:00:00 UTC を基準にする） */
export const BASE_TIME = 1_790_812_800;

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

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
    `INSERT INTO cats (id, household_id, name, sex, birth_date, birth_date_precision, memorial_date, created_at) VALUES
      ('cat-1', 'household-1', 'みけ', 'female', '2020-04-01', 'month', NULL, ${BASE_TIME}),
      ('cat-2', 'household-1', 'くろ', 'male', NULL, 'day', '2026-09-30', ${BASE_TIME + 60}),
      ('cat-3', NULL, 'しろ', 'unknown', NULL, 'day', NULL, ${BASE_TIME})`,
  );
  db.run(
    `INSERT INTO sessions (token_hash, id, user_id, user_agent, expires_at, created_at) VALUES
      ('hash-active-1', 'session-active-1', 'user-1', '${IPHONE_SAFARI}', ${BASE_TIME + 86_400}, ${BASE_TIME}),
      ('hash-active-2', 'session-active-2', 'user-1', NULL, ${BASE_TIME + 172_800}, ${BASE_TIME + 60}),
      ('hash-expired', 'session-expired', 'user-1', NULL, ${BASE_TIME - 1}, ${BASE_TIME - 100}),
      ('hash-expired-2', 'session-expired-2', 'user-3', NULL, ${BASE_TIME - 1}, ${BASE_TIME - 100})`,
  );
  db.run(
    `INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, user_agent, failure_count, created_at, last_used_at) VALUES
      ('push-1', 'user-1', 'https://push.example.com/secret-endpoint', 'secret-p256dh', 'secret-auth', '${IPHONE_SAFARI}', 2, ${BASE_TIME}, ${BASE_TIME + 30})`,
  );
  // household-1 への招待。使われたもの（user-2 が参加）・期限が切れたもの・まだ使えるもの
  db.run(
    `INSERT INTO household_invitations (id, household_id, token_hash, created_by_user_id, expires_at, accepted_by_user_id, accepted_at, created_at) VALUES
      ('invitation-accepted', 'household-1', 'invitation-hash-1', 'user-1', ${BASE_TIME + 86_400}, 'user-2', ${BASE_TIME + 60}, ${BASE_TIME}),
      ('invitation-expired', 'household-1', 'invitation-hash-2', 'user-1', ${BASE_TIME}, NULL, NULL, ${BASE_TIME - 60}),
      ('invitation-pending', 'household-1', 'invitation-hash-3', 'user-1', ${BASE_TIME + 86_400}, NULL, NULL, ${BASE_TIME + 120})`,
  );
}
