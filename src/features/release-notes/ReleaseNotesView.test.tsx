import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RELEASE_NOTES_PAGE_SIZE, ReleaseNotesView } from "./ReleaseNotesView";
import type { ReleaseNote } from "./schema";

/** 新しい順に並べた n 件のダミーのリリースノート（タイトルは「更新 n」〜「更新 1」） */
function buildNotes(count: number): ReleaseNote[] {
  return Array.from({ length: count }, (_, index) => {
    const number = count - index;
    return {
      version: `0.${number}.0`,
      date: "2024-06-01",
      title: `更新 ${number}`,
      items: [`変更点 ${number}`],
    };
  });
}

describe("ReleaseNotesView", () => {
  it("渡したリリースノートを並び順のまま表示し、先頭にだけ「最新」を付ける", () => {
    render(
      <ReleaseNotesView
        notes={[
          {
            version: "0.2.0",
            date: "2024-06-10",
            title: "新しい更新",
            items: ["新しい変更点"],
          },
          {
            version: "0.1.0",
            date: "2024-06-01",
            title: "古い更新",
            items: ["古い変更点"],
          },
        ]}
        basePath="/release-notes"
      />,
    );

    const headings = screen.getAllByRole("heading", { level: 2 });
    expect(headings.map((heading) => heading.textContent)).toEqual([
      "新しい更新",
      "古い更新",
    ]);
    expect(screen.getAllByText("最新")).toHaveLength(1);
    expect(screen.getByText("v0.2.0")).toBeInTheDocument();
    expect(screen.getByText("古い変更点")).toBeInTheDocument();
  });

  it("リリースノートがないときは空の案内を表示する", () => {
    render(<ReleaseNotesView notes={[]} basePath="/release-notes" />);

    expect(screen.getByText("更新情報はまだありません。")).toBeInTheDocument();
  });

  it("1ページ目には先頭から50件だけを表示し、次のページへのリンクを出す", () => {
    render(
      <ReleaseNotesView
        notes={buildNotes(RELEASE_NOTES_PAGE_SIZE + 1)}
        page={1}
        basePath="/release-notes"
      />,
    );

    const headings = screen.getAllByRole("heading", { level: 2 });
    expect(headings).toHaveLength(RELEASE_NOTES_PAGE_SIZE);
    expect(headings[0]).toHaveTextContent("更新 51");
    expect(screen.queryByRole("heading", { name: "更新 1" })).toBeNull();
    expect(screen.getAllByText("最新")).toHaveLength(1);
    expect(
      screen.getByRole("navigation", { name: "ページ" }),
    ).toHaveTextContent("1 / 2");
    expect(screen.getByRole("link", { name: "次のページ" })).toHaveAttribute(
      "href",
      "/release-notes?page=2",
    );
  });

  it("2ページ目には残りを表示し、「最新」は付けない", () => {
    render(
      <ReleaseNotesView
        notes={buildNotes(RELEASE_NOTES_PAGE_SIZE + 1)}
        page={2}
        basePath="/release-notes"
      />,
    );

    const headings = screen.getAllByRole("heading", { level: 2 });
    expect(headings.map((heading) => heading.textContent)).toEqual(["更新 1"]);
    expect(screen.queryByText("最新")).toBeNull();
    expect(screen.getByRole("link", { name: "前のページ" })).toHaveAttribute(
      "href",
      "/release-notes",
    );
    expect(screen.queryByRole("link", { name: "次のページ" })).toBeNull();
  });

  it("総ページ数を超えるページを指定したときは最終ページを表示する", () => {
    render(
      <ReleaseNotesView
        notes={buildNotes(RELEASE_NOTES_PAGE_SIZE + 1)}
        page={5}
        basePath="/release-notes"
      />,
    );

    expect(
      screen.getByRole("navigation", { name: "ページ" }),
    ).toHaveTextContent("2 / 2");
    expect(screen.getByRole("heading", { name: "更新 1" })).toBeInTheDocument();
  });

  it("1ページに収まるときはページ送りを表示しない", () => {
    render(
      <ReleaseNotesView
        notes={buildNotes(RELEASE_NOTES_PAGE_SIZE)}
        basePath="/release-notes"
      />,
    );

    expect(screen.queryByRole("navigation", { name: "ページ" })).toBeNull();
  });
});
