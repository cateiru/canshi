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
function postForm(path: string, origin = ORIGIN, body = "") {
  return request(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: origin,
    },
    body,
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

async function householdRoles(householdId: string) {
  const { results } = await env.DB.prepare(
    "SELECT user_id, role FROM household_members WHERE household_id = ?1 ORDER BY user_id",
  )
    .bind(householdId)
    .all<{ user_id: string; role: string }>();
  return results.map((row) => `${row.user_id}:${row.role}`);
}

describe("家のメンバーの追加・削除", () => {
  it("まだメンバーでないユーザーだけを追加の候補にし、オーナー以外にだけ外すボタンを表示する", async () => {
    const html = await (await request("/households")).text();
    expect(html).toContain('action="/households/household-2/members"');
    // household-1 には user-3 だけが候補になる
    const household1Form = html.slice(
      html.indexOf('action="/households/household-1/members"'),
    );
    const select = household1Form.slice(0, household1Form.indexOf("</select>"));
    expect(select).toContain('value="user-3"');
    expect(select).not.toContain('value="user-1"');
    expect(select).not.toContain('value="user-2"');

    expect(html).toContain(
      'action="/households/household-1/members/user-2/delete"',
    );
    expect(html).not.toContain(
      'action="/households/household-1/members/user-1/delete"',
    );
  });

  it("ユーザーをメンバーとして追加し、結果を家の一覧に表示する", async () => {
    const response = await postForm(
      "/households/household-2/members",
      ORIGIN,
      "userId=user-3",
    );
    expect(response.status).toBe(303);
    const location = response.headers.get("Location") ?? "";
    expect(location).toBe(
      "/households?memberChange=added&household=household-2&user=user-3",
    );
    expect(await householdRoles("household-2")).toEqual([
      "user-1:owner",
      "user-3:member",
    ]);

    const html = await (await request(location)).text();
    expect(html).toContain("はなこ を 実家 のメンバーに追加しました。");
  });

  it("すでにメンバーのユーザーは追加せず、失敗を表示する", async () => {
    const response = await postForm(
      "/households/household-1/members",
      ORIGIN,
      "userId=user-1",
    );
    const location = response.headers.get("Location") ?? "";
    expect(location).toContain("memberChange=add-failed");
    expect(await householdRoles("household-1")).toEqual([
      "user-1:owner",
      "user-2:member",
    ]);
    const html = await (await request(location)).text();
    expect(html).toContain("のメンバーに追加できませんでした");
  });

  it("オーナー以外のメンバーを家から外し、結果を表示する", async () => {
    const response = await postForm(
      "/households/household-1/members/user-2/delete",
    );
    expect(response.status).toBe(303);
    const location = response.headers.get("Location") ?? "";
    expect(await householdRoles("household-1")).toEqual(["user-1:owner"]);
    const html = await (await request(location)).text();
    // ユーザー名はエスケープして表示する
    expect(html).toContain(
      "&lt;script&gt;alert(1)&lt;/script&gt; を わが家 から外しました。",
    );
  });

  it("オーナーは外さず、失敗を表示する", async () => {
    const response = await postForm(
      "/households/household-1/members/user-1/delete",
    );
    const location = response.headers.get("Location") ?? "";
    expect(location).toContain("memberChange=remove-failed");
    expect(await householdRoles("household-1")).toEqual([
      "user-1:owner",
      "user-2:member",
    ]);
    const html = await (await request(location)).text();
    expect(html).toContain("オーナーは外せないため");
  });

  it("ほかのオリジンからの送信は拒否し、メンバーを変えない", async () => {
    const added = await postForm(
      "/households/household-2/members",
      "https://evil.example.com",
      "userId=user-3",
    );
    expect(added.status).toBe(403);
    const removed = await postForm(
      "/households/household-1/members/user-2/delete",
      "https://evil.example.com",
    );
    expect(removed.status).toBe(403);
    expect(await householdRoles("household-1")).toEqual([
      "user-1:owner",
      "user-2:member",
    ]);
    expect(await householdRoles("household-2")).toEqual(["user-1:owner"]);
  });
});
