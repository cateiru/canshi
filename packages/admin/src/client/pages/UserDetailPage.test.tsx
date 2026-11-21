import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { USER_DETAIL } from "../test/fixtures";
import {
  currentLocation,
  renderApp,
  stubApi,
  waitForLoaded,
} from "../test/render";

describe("ユーザーの詳細", () => {
  it("基本情報・所属する家・ログイン中の端末を表示し、家の詳細へのリンクを出す", async () => {
    stubApi({ "GET /users/user-1": USER_DETAIL });
    await renderApp("/users/user-1");
    expect(
      screen.getByRole("heading", { level: 2, name: "たろう" }),
    ).toBeInTheDocument();
    expect(document.title).toBe("たろう | CANSHI 管理画面");
    expect(screen.getByRole("link", { name: "わが家" })).toHaveAttribute(
      "href",
      "/households/household-1",
    );
    // パンくずから一覧へ戻れる
    const breadcrumb = screen.getByRole("navigation", {
      name: "パンくずリスト",
    });
    expect(
      within(breadcrumb).getByRole("link", { name: "ユーザー" }),
    ).toHaveAttribute("href", "/users");
    expect(screen.getByText("iPhone・Safari")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "すべての端末からログアウト" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("通知を受け取る端末はありません。"),
    ).toBeInTheDocument();
  });

  it("ログイン中の端末がなければ、ログアウトさせるボタンを出さない", async () => {
    stubApi({
      "GET /users/user-1": {
        user: { ...USER_DETAIL.user, sessions: [], households: [] },
      },
    });
    await renderApp("/users/user-1");
    expect(
      screen.getByText("ログイン中の端末はありません。"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("どの家にも所属していません。"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "すべての端末からログアウト" }),
    ).toBeNull();
  });

  it("権限を変え、結果を詳細の URL のクエリで表示する", async () => {
    let sent: unknown = null;
    const fetchMock = stubApi({
      "GET /users/user-1": USER_DETAIL,
      "POST /users/user-1/role": (init) => {
        sent = JSON.parse(String(init?.body));
        return { status: 200, body: { ok: true } };
      },
    });
    await renderApp("/users/user-1");
    screen.getByRole("button", { name: "変更" }).click();
    await screen.findByText(/^たろう の権限を/);
    expect(sent).toEqual({ role: "admin" });
    expect(currentLocation()).toBe(
      "/users/user-1?roleChange=updated&user=user-1",
    );
    // 送ったあとは詳細を読み込み直す
    await waitForLoaded();
    expect(
      fetchMock.mock.calls.filter(
        ([url]) => String(url) === "/api/users/user-1",
      ),
    ).toHaveLength(2);
  });

  it("すべての端末からログアウトさせ、結果を表示する", async () => {
    let deleted = false;
    stubApi({
      "GET /users/user-1": USER_DETAIL,
      "DELETE /users/user-1/sessions": () => {
        deleted = true;
        return { status: 200, body: { ok: true } };
      },
    });
    await renderApp("/users/user-1");
    screen.getByRole("button", { name: "すべての端末からログアウト" }).click();
    const dialog = await screen.findByRole("dialog");
    within(dialog).getByRole("button", { name: "ログアウトさせる" }).click();
    expect(await screen.findByRole("status")).toHaveTextContent(
      "たろう をすべての端末からログアウトさせました。",
    );
    expect(deleted).toBe(true);
    expect(currentLocation()).toBe("/users/user-1?loggedOut=user-1");
  });

  it("存在しないユーザーは、見つからないことを表示する", async () => {
    stubApi({});
    await renderApp("/users/missing");
    expect(
      screen.getByRole("heading", { level: 2, name: "ページが見つかりません" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/ユーザーが見つかりませんでした。/),
    ).toBeInTheDocument();
  });
});
