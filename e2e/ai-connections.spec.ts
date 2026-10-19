import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { DEVELOPMENT_LOGIN_EMAIL } from "../src/features/auth/developmentLogin";
import {
  DEVELOPMENT_EMAIL_HASH_SALT,
  hashEmail,
} from "../src/features/auth/emailHash";

const CLIENT_ID = "e2e-client";
const GRANT_ID = "e2eGrant";
const CAT_ID = "e2e-ai-connection-cat";
const CAT_NAME = "AIとの接続のE2E猫";

// 接続（OAuth の grant）は AI のアプリから同意しないと作れないため、ローカルの D1 に
// `@cloudflare/workers-oauth-provider` と同じキー・形式で直接追加する
// （`e2e/fixtures/vrt-seed.sql` と同じ）。dev サーバーと書き込みが重なると SQLITE_BUSY で
// 失敗することがあるため、少し待ってやり直す（e2e/auth.setup.ts と同じ）
async function executeSql(command: string) {
  await expect(async () => {
    execFileSync(
      "node_modules/.bin/wrangler",
      [
        "d1",
        "execute",
        "DB",
        "--local",
        "--persist-to",
        ".wrangler/state",
        "--command",
        command,
      ],
      { stdio: "inherit" },
    );
  }).toPass({ intervals: [1_000, 2_000, 5_000], timeout: 60_000 });
}

const loginUserId = `(SELECT id FROM users WHERE email_hash = '${hashEmail(
  DEVELOPMENT_LOGIN_EMAIL,
  DEVELOPMENT_EMAIL_HASH_SALT,
)}')`;

// 範囲のページで記録の種類を選べるよう、ログインユーザーの家に猫も追加する。CI では
// このファイルが猫を登録するテストより先に走り、家に猫がいないことがあるため
test.beforeEach(async () => {
  await executeSql(
    `INSERT OR REPLACE INTO oauth_kv_entries (key, value)
    VALUES ('client:${CLIENT_ID}', json_object('clientId', '${CLIENT_ID}', 'clientName', 'E2Eのアプリ', 'redirectUris', json_array('https://e2e.example.test/cb')));
    INSERT OR REPLACE INTO oauth_kv_entries (key, value)
    SELECT 'grant:' || id || ':${GRANT_ID}', json_object('id', '${GRANT_ID}', 'clientId', '${CLIENT_ID}', 'userId', id, 'scope', json_array(), 'metadata', json_object(), 'encryptedProps', '', 'createdAt', unixepoch(), 'redirectUri', 'https://e2e.example.test/cb')
    FROM users WHERE id = ${loginUserId};
    INSERT OR REPLACE INTO cats (id, household_id, name, sex, created_at, updated_at)
    SELECT '${CAT_ID}', household_id, '${CAT_NAME}', 'unknown', unixepoch(), unixepoch()
    FROM household_members WHERE user_id = ${loginUserId}
    ORDER BY created_at, household_id LIMIT 1;`,
  );
});

// 後続のテスト（VRT など）に影響しないよう、追加した接続・範囲・猫を消す
test.afterEach(async () => {
  await executeSql(
    `DELETE FROM oauth_kv_entries WHERE key IN ('client:${CLIENT_ID}', 'grant:' || ${loginUserId} || ':${GRANT_ID}');
    DELETE FROM mcp_permissions WHERE client_id = '${CLIENT_ID}';
    DELETE FROM mcp_connection_usages WHERE grant_id = '${GRANT_ID}';
    DELETE FROM cats WHERE id = '${CAT_ID}';`,
  );
});

test("AIとの接続ごとに、読み取りを許可する記録の種類を外して保存すると、再読み込み後も保たれる", async ({
  page,
}) => {
  await page.goto("/settings/ai-connections");
  const connection = page.getByRole("region", { name: "E2Eのアプリとの接続" });
  await connection.getByRole("link", { name: "読み取る範囲" }).click();
  await expect(page).toHaveURL(`/settings/ai-connections/${GRANT_ID}`);
  await expect(
    page.getByRole("heading", { level: 1, name: "E2Eのアプリ" }),
  ).toBeVisible();

  const permissions = page.getByRole("region", {
    name: "読み取りを許可する範囲",
  });
  // ほかのテストで残った猫に影響されないよう、beforeEach で追加した猫の記録を操作する
  const records = permissions.getByRole("group", { name: `${CAT_NAME}の記録` });
  // Checkbox の実体（input）は視覚的に隠れておりクリック不可のため、
  // クリックは表示テキスト、状態確認は checkbox ロールに対して行う
  const poop = records.getByRole("checkbox", { name: "うんち" });
  await expect(poop).toBeChecked();

  await records.getByText("うんち", { exact: true }).click();
  await expect(poop).not.toBeChecked();
  await permissions.getByRole("button", { name: "保存する" }).click();
  await expect(
    page.getByText("読み取りを許可する範囲を保存しました"),
  ).toBeVisible();

  await page.reload();
  await expect(poop).not.toBeChecked();
  await expect(records.getByRole("checkbox", { name: "ごはん" })).toBeChecked();
});

test("AIとの接続の一覧に、接続を最後に使った日時を表示する", async ({
  page,
}) => {
  await page.goto("/settings/ai-connections");
  const connection = page.getByRole("region", { name: "E2Eのアプリとの接続" });
  const lastUsedAt = connection
    .getByText("最終接続日時", { exact: true })
    .locator("xpath=following-sibling::dd");
  await expect(lastUsedAt).toHaveText("記録がありません");

  await executeSql(
    `INSERT INTO mcp_connection_usages (user_id, grant_id, last_used_at)
    SELECT id, '${GRANT_ID}', unixepoch() FROM users WHERE id = ${loginUserId};`,
  );
  await page.reload();
  await expect(lastUsedAt).toHaveText(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
});

test("解除した接続や、存在しない接続の範囲のページは表示しない", async ({
  page,
}) => {
  const response = await page.goto("/settings/ai-connections/missingGrant");
  expect(response?.status()).toBe(404);
});
