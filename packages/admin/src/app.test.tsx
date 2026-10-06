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

function request(path: string) {
  return createApp().request(
    `https://canshi-admin.cateiru.dev${path}`,
    {},
    env,
  );
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
