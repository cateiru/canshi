import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { RecordContributor } from "../domain/contributor";
import { RecordContributors } from "./RecordContributors";

function user(name: string): RecordContributor {
  return { kind: "user", userName: name, iconMediaAssetId: null };
}

describe("RecordContributors", () => {
  it("作成・編集した人がいなければ何も表示しない", () => {
    const { container: empty } = render(
      <RecordContributors contributors={[]} />,
    );
    expect(empty).toBeEmptyDOMElement();
    const { container: none } = render(
      <RecordContributors contributors={undefined} />,
    );
    expect(none).toBeEmptyDOMElement();
  });

  it("3 名までは全員のアイコンを並べ、名前を title に入れる", () => {
    render(
      <RecordContributors
        contributors={[user("たろう"), user("はなこ"), user("じろう")]}
      />,
    );

    const list = screen.getByRole("list", { name: "作成・編集した人" });
    const items = within(list).getAllByRole("listitem");
    expect(items.map((item) => item.getAttribute("title"))).toEqual([
      "たろう",
      "はなこ",
      "じろう",
    ]);
    expect(screen.queryByText(/^\+/)).not.toBeInTheDocument();
  });

  it("4 名以上は 3 名まで表示し、残りを「+N」にまとめる", () => {
    render(
      <RecordContributors
        contributors={[
          user("たろう"),
          user("はなこ"),
          user("じろう"),
          user("さぶろう"),
          user("しろう"),
        ]}
      />,
    );

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(4);
    const more = items[3];
    expect(more).toHaveAttribute("title", "さぶろう、しろう");
    expect(within(more).getByText("+2")).toHaveAttribute("aria-hidden", "true");
    expect(more).toHaveTextContent("ほか2名：さぶろう、しろう");
  });

  it("AI のアプリはアプリの名前で読み上げ、わからないアプリも表示する", () => {
    render(
      <RecordContributors
        contributors={[
          {
            kind: "ai",
            userName: "たろう",
            clientName: "Claude",
            app: "claude",
          },
          { kind: "ai", userName: "たろう", clientName: null, app: null },
        ]}
      />,
    );

    expect(
      screen.getByRole("img", { name: "Claude（たろうが接続）" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "AIのアプリ（たろうが接続）" }),
    ).toBeInTheDocument();
  });
});
