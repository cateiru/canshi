import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "./app";
import { createMigratedDatabase, toAdminDb } from "./test/d1";
import { seed } from "./test/fixtures";

let env: Env;

beforeEach(async () => {
  const database = await createMigratedDatabase();
  seed(database);
  env = { DB: toAdminDb(database) as D1Database };
});

const ORIGIN = "https://canshi-admin.cateiru.dev";

function request(path: string, init: RequestInit = {}) {
  return createApp().request(`${ORIGIN}${path}`, init, env);
}

/** 管理画面のフォームからの送信（ブラウザは Origin を付ける） */
function postForm(path: string, origin = ORIGIN) {
  return request(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: origin,
    },
    body: "",
  });
}

async function countSessions(userId: string) {
  const { results } = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM sessions WHERE user_id = ?1",
  )
    .bind(userId)
    .all<{ count: number }>();
  return results[0].count;
}

describe("画面", () => {
  it("概要に件数と、家に未所属の猫の警告を表示する", async () => {
    const response = await request("/");
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const html = await response.text();
    expect(html).toContain("家に所属していない猫が 1");
    // `household:link` は --local・--remote のどちらかが無いと実行できない
    expect(html).toContain("pnpm household:link --remote");
  });

  it("ユーザー一覧で、利用者の入力した名前をエスケープして表示する", async () => {
    const response = await request("/users");
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("たろう");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
    // セッションのトークン（ハッシュ）は表示しない
    expect(html).not.toContain("hash-active-1");
  });

  it("家の一覧に、メンバーと猫の数を表示する", async () => {
    const response = await request("/households");
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("わが家");
    expect(html).toContain("たろう（オーナー）");
  });
});

describe("すべての端末からログアウトさせる", () => {
  beforeEach(async () => {
    // 画面は実行時の日時で有効なセッションを数えるため、テスト用データ（2026-10-01 基準）の
    // セッションとは別に、期限が十分先のセッションを user-1 に作る
    const expiresAt = Math.floor(Date.now() / 1000) + 86_400;
    await env.DB.prepare(
      "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ('hash-current', 'user-1', ?1)",
    )
      .bind(expiresAt)
      .run();
  });

  it("有効なセッションがあるユーザーにだけボタンを表示する", async () => {
    const html = await (await request("/users")).text();
    expect(html).toContain('action="/users/user-1/sessions/delete"');
    // 期限切れのセッションしかないユーザー・セッションが無いユーザー
    expect(html).not.toContain('action="/users/user-2/sessions/delete"');
    expect(html).not.toContain('action="/users/user-3/sessions/delete"');
  });

  it("ユーザーのセッションをすべて削除し、結果をユーザー一覧に表示する", async () => {
    const response = await postForm("/users/user-1/sessions/delete");
    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe("/users?loggedOut=user-1");
    expect(await countSessions("user-1")).toBe(0);
    // ほかのユーザーのセッションは残る
    expect(await countSessions("user-3")).toBe(1);

    const html = await (
      await request(response.headers.get("Location") ?? "")
    ).text();
    expect(html).toContain("たろう をすべての端末からログアウトさせました。");
  });

  it("ほかのオリジンからの送信は拒否し、セッションを削除しない", async () => {
    const response = await postForm(
      "/users/user-1/sessions/delete",
      "https://evil.example.com",
    );
    expect(response.status).toBe(403);
    expect(await countSessions("user-1")).toBe(4);
  });
});
