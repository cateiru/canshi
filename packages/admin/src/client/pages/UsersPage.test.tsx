import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { user } from "../test/fixtures";
import { renderApp, stubApi } from "../test/render";

const USERS = {
  users: [
    user({
      id: "user-1",
      name: "たろう",
      role: "admin",
      activeSessionCount: 2,
      households: [
        { householdId: "household-1", householdName: "わが家", role: "owner" },
      ],
    }),
    user({ id: "user-2", name: "<script>alert(1)</script>" }),
  ],
};

describe("ユーザー", () => {
  it("利用者の入力した名前を文字として表示し、ユーザー・家の詳細へリンクする", async () => {
    stubApi({ "GET /users": USERS });
    await renderApp("/users");
    expect(
      screen.getByRole("link", { name: "<script>alert(1)</script>" }),
    ).toHaveAttribute("href", "/users/user-2");
    expect(document.querySelector("script")).toBeNull();
    expect(screen.getByRole("link", { name: "たろう" })).toHaveAttribute(
      "href",
      "/users/user-1",
    );
    expect(screen.getByRole("link", { name: "わが家" })).toHaveAttribute(
      "href",
      "/households/household-1",
    );
    expect(screen.getByText("管理者")).toBeInTheDocument();
  });

  it("一覧では操作せず、権限の変更・ログアウトのボタンを出さない", async () => {
    stubApi({ "GET /users": USERS });
    await renderApp("/users");
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
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
