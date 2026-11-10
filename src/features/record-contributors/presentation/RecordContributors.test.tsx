import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type {
  RecordContributions,
  RecordContributor,
} from "../domain/contributor";
import { RecordContributors } from "./RecordContributors";

function user(name: string): RecordContributor {
  return { kind: "user", userName: name, iconMediaAssetId: null };
}

/** 1 人 1 回ずつ、順に保存した記録 */
function contributionsOf(
  contributors: RecordContributor[],
): RecordContributions {
  return {
    contributors,
    history: contributors.map((_, index) => ({
      contributorIndex: index,
      changedAt: new Date(Date.UTC(2026, 6, 1 + index)),
    })),
  };
}

describe("RecordContributors", () => {
  it("作成・編集した人がいなければ何も表示しない", () => {
    const { container: empty } = render(
      <RecordContributors contributors={{ contributors: [], history: [] }} />,
    );
    expect(empty).toBeEmptyDOMElement();
    const { container: none } = render(
      <RecordContributors contributors={undefined} />,
    );
    expect(none).toBeEmptyDOMElement();
  });

  it("2 名までは全員のアイコンを並べ、名前を title とボタンの名前に入れる", () => {
    const { container } = render(
      <RecordContributors
        contributors={contributionsOf([user("たろう"), user("はなこ")])}
      />,
    );

    expect(
      screen.getByRole("button", {
        name: "編集履歴を見る（作成・編集した人：たろう、はなこ）",
      }),
    ).toBeInTheDocument();
    expect(
      [...container.querySelectorAll("[title]")].map((item) =>
        item.getAttribute("title"),
      ),
    ).toEqual(["たろう", "はなこ"]);
    expect(screen.queryByText(/^\+/)).not.toBeInTheDocument();
  });

  it("3 名以上は 2 名まで表示し、残りを「+N」にまとめる", () => {
    render(
      <RecordContributors
        contributors={contributionsOf([
          user("たろう"),
          user("はなこ"),
          user("じろう"),
          user("さぶろう"),
        ])}
      />,
    );

    const more = screen.getByText("+2");
    expect(more.parentElement).toHaveAttribute("title", "じろう、さぶろう");
    expect(
      screen.getByRole("button", {
        name: "編集履歴を見る（作成・編集した人：たろう、はなこ、じろう、さぶろう）",
      }),
    ).toBeInTheDocument();
  });

  it("アイコンを押すと、新しい保存を上・作成を一番下にした編集履歴を表示する", async () => {
    render(
      <RecordContributors
        contributors={{
          contributors: [
            user("たろう"),
            {
              kind: "ai",
              userName: "はなこ",
              clientName: "Claude",
              app: "claude",
            },
          ],
          history: [
            {
              contributorIndex: 0,
              changedAt: new Date("2026-07-01T00:05:00Z"),
            },
            {
              contributorIndex: 1,
              changedAt: new Date("2026-07-02T15:30:00Z"),
            },
            {
              contributorIndex: 0,
              changedAt: new Date("2026-07-03T03:00:00Z"),
            },
          ],
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^編集履歴を見る/ }));

    const dialog = await screen.findByRole("dialog", { name: "編集履歴" });
    const list = within(dialog).getByRole("list", {
      name: "編集履歴（新しい順）",
    });
    expect(
      within(list)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual([
      // 日時は JST で表示する
      "たろう2026/07/03 12:00",
      "Claude（はなこが接続）2026/07/03 00:30",
      "たろう2026/07/01 09:05",
    ]);

    fireEvent.click(within(dialog).getByRole("button", { name: "閉じる" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("AI のアプリはアプリのアイコンで表示し、わからないアプリも表示する", () => {
    render(
      <RecordContributors
        contributors={contributionsOf([
          {
            kind: "ai",
            userName: "たろう",
            clientName: "Claude",
            app: "claude",
          },
          { kind: "ai", userName: "たろう", clientName: null, app: null },
        ])}
      />,
    );

    expect(
      screen.getByTitle("Claude（たろうが接続）").querySelector("svg"),
    ).not.toBeNull();
    expect(
      screen.getByTitle("AIのアプリ（たろうが接続）").querySelector("svg"),
    ).not.toBeNull();
  });
});
