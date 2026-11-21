import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { user } from "../test/fixtures";
import {
  currentLocation,
  renderApp,
  stubApi,
  waitForLoaded,
} from "../test/render";

const USERS = {
  users: [
    user({
      id: "user-1",
      name: "たろう",
      role: "admin",
      activeSessionCount: 2,
    }),
    user({ id: "user-2", name: "<script>alert(1)</script>" }),
  ],
};

describe("ユーザー", () => {
  it("利用者の入力した名前を文字として表示し、有効なセッションがあるユーザーにだけログアウトのボタンを出す", async () => {
    stubApi({ "GET /users": USERS });
    await renderApp("/users");
    expect(screen.getByText("<script>alert(1)</script>")).toBeInTheDocument();
    expect(document.querySelector("script")).toBeNull();
    expect(
      screen.getAllByRole("button", { name: "すべての端末からログアウト" }),
    ).toHaveLength(1);
    // 管理者にしても管理画面に入れるわけではないことを示す
    expect(
      screen.getByText(/この管理画面に入れるようにはなりません/),
    ).toBeInTheDocument();
  });

  it("権限を変え、結果を URL のクエリで表示する", async () => {
    let sent: unknown = null;
    const fetchMock = stubApi({
      "GET /users": USERS,
      "POST /users/user-2/role": (init) => {
        sent = JSON.parse(String(init?.body));
        return { status: 200, body: { ok: true } };
      },
    });
    await renderApp("/users");
    const row = screen.getByText("<script>alert(1)</script>").closest("tr");
    if (!row) {
      throw new Error("行がありません");
    }
    within(row).getByRole("button", { name: "変更" }).click();
    await screen.findByText(/^<script>alert\(1\)<\/script> の権限を/);
    expect(sent).toEqual({ role: "member" });
    expect(currentLocation()).toBe("/users?roleChange=updated&user=user-2");
    // 送ったあとは一覧を読み込み直す
    await waitForLoaded();
    expect(
      fetchMock.mock.calls.filter(([url]) => String(url) === "/api/users"),
    ).toHaveLength(2);
  });

  it("すべての端末からログアウトさせた結果を表示する", async () => {
    stubApi({ "GET /users": USERS });
    await renderApp("/users?loggedOut=user-1");
    expect(screen.getByRole("status")).toHaveTextContent(
      "たろう をすべての端末からログアウトさせました。",
    );
  });

  it("権限を変えられなかった結果を表示する", async () => {
    stubApi({ "GET /users": USERS });
    await renderApp("/users?roleChange=update-failed&user=user-1");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "たろう の権限を変えられませんでした。",
    );
  });

  it("読み込めなかったときは理由を表示する", async () => {
    stubApi({
      "GET /users": () => ({ status: 500, body: { error: "失敗しました" } }),
    });
    await renderApp("/users");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "読み込めませんでした。失敗しました",
    );
  });
});
