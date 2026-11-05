import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReleaseNotesView } from "./ReleaseNotesView";

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
    render(<ReleaseNotesView notes={[]} />);

    expect(screen.getByText("更新情報はまだありません。")).toBeInTheDocument();
  });
});
