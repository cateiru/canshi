import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { listReleaseNotes } from "@/features/release-notes/data";
import ReleaseNotesPage from "./page";

describe("ReleaseNotesPage", () => {
  it("release-notes.json の内容を表示する", () => {
    render(<ReleaseNotesPage />);

    const [latest] = listReleaseNotes();
    expect(
      screen.getByRole("heading", { name: "更新情報" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: `v${latest.version} ${latest.title}`,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(latest.items[0])).toBeInTheDocument();
  });
});
