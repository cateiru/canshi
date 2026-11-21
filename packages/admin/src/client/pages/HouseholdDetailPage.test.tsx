import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HOUSEHOLD_DETAIL } from "../test/fixtures";
import { currentLocation, renderApp, stubApi } from "../test/render";

describe("家の詳細", () => {
  it("メンバー・猫・招待を表示し、ユーザーの詳細へのリンクを出す", async () => {
    stubApi({ "GET /households/household-1": HOUSEHOLD_DETAIL });
    await renderApp("/households/household-1");
    expect(
      screen.getByRole("heading", { level: 2, name: "わが家" }),
    ).toBeInTheDocument();
    // 利用者の入力した名前は文字として表示する
    expect(document.querySelector("script")).toBeNull();
    const memberLinks = screen.getAllByRole("link", {
      name: "<script>alert(1)</script>",
    });
    for (const link of memberLinks) {
      expect(link).toHaveAttribute("href", "/users/user-2");
    }
    // オーナーは外せないため、メンバーにだけ外すボタンを出す
    expect(screen.getAllByRole("button", { name: "家から外す" })).toHaveLength(
      1,
    );
    // 年月までわかっている生年月日は、補った日を表示しない
    expect(screen.getByText("2020年4月")).toBeInTheDocument();
    expect(screen.getByText("使用済み")).toBeInTheDocument();
  });

  it("まだメンバーでないユーザーだけを追加の候補にし、結果を詳細の URL のクエリで表示する", async () => {
    let sent: unknown = null;
    stubApi({
      "GET /households/household-1": HOUSEHOLD_DETAIL,
      "POST /households/household-1/members": (init) => {
        sent = JSON.parse(String(init?.body));
        return { status: 200, body: { ok: true } };
      },
    });
    await renderApp("/households/household-1");
    screen.getByRole("button", { name: "メンバーとして追加" }).click();
    expect(await screen.findByRole("status")).toHaveTextContent(
      "はなこ を わが家 のメンバーに追加しました。",
    );
    expect(sent).toEqual({ userId: "user-3" });
    expect(currentLocation()).toBe(
      "/households/household-1?memberChange=added&user=user-3",
    );
  });

  it("メンバーを家から外し、結果を表示する", async () => {
    let removed = false;
    stubApi({
      "GET /households/household-1": HOUSEHOLD_DETAIL,
      "DELETE /households/household-1/members/user-2": () => {
        removed = true;
        return { status: 200, body: { ok: true } };
      },
    });
    await renderApp("/households/household-1");
    screen.getByRole("button", { name: "家から外す" }).click();
    const dialog = await screen.findByRole("dialog");
    within(dialog).getByRole("button", { name: "外す" }).click();
    expect(await screen.findByRole("status")).toHaveTextContent(
      "<script>alert(1)</script> を わが家 から外しました。",
    );
    expect(removed).toBe(true);
    expect(currentLocation()).toBe(
      "/households/household-1?memberChange=removed&user=user-2",
    );
  });

  it("オーナーを外せなかった結果を表示する", async () => {
    stubApi({ "GET /households/household-1": HOUSEHOLD_DETAIL });
    await renderApp(
      "/households/household-1?memberChange=remove-failed&user=user-1",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "たろう を わが家 から外せませんでした。",
    );
  });

  it("全員がメンバーなら追加のフォームを出さず、猫・招待がなければその旨を表示する", async () => {
    stubApi({
      "GET /households/household-1": {
        ...HOUSEHOLD_DETAIL,
        household: { ...HOUSEHOLD_DETAIL.household, cats: [], invitations: [] },
        users: HOUSEHOLD_DETAIL.users.slice(0, 2),
      },
    });
    await renderApp("/households/household-1");
    expect(
      screen.queryByRole("button", { name: "メンバーとして追加" }),
    ).toBeNull();
    expect(screen.getByText("猫はまだいません。")).toBeInTheDocument();
    expect(screen.getByText("招待はありません。")).toBeInTheDocument();
  });

  it("存在しない家は、見つからないことを表示する", async () => {
    stubApi({});
    await renderApp("/households/missing");
    expect(screen.getByText(/家が見つかりませんでした。/)).toBeInTheDocument();
  });
});
