import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { HouseholdsResponse } from "../../api/types";
import { renderApp, stubApi } from "../test/render";

const HOUSEHOLDS: HouseholdsResponse = {
  households: [
    {
      id: "household-1",
      name: "わが家",
      createdAt: "2026-10-01T00:00:00.000Z",
      catCount: 2,
      members: [
        { userId: "user-1", userName: "たろう", role: "owner" },
        { userId: "user-2", userName: "はなこ", role: "member" },
      ],
    },
  ],
};

describe("家", () => {
  it("家・メンバーの詳細へリンクし、一覧では操作のボタンを出さない", async () => {
    stubApi({ "GET /households": HOUSEHOLDS });
    await renderApp("/households");
    expect(screen.getByRole("link", { name: "わが家" })).toHaveAttribute(
      "href",
      "/households/household-1",
    );
    expect(screen.getByRole("link", { name: "はなこ" })).toHaveAttribute(
      "href",
      "/users/user-2",
    );
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("家がなければその旨を表示する", async () => {
    stubApi({ "GET /households": { households: [] } });
    await renderApp("/households");
    expect(screen.getByText("家はまだありません。")).toBeInTheDocument();
  });
});
