import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MediaGallery } from "./MediaGallery";
import type { MediaAssetView } from "./view";

function asset(id: string, kind: "image" | "video" = "image"): MediaAssetView {
  return {
    id,
    recordType: "poop_record",
    recordId: "rec-1",
    catId: "cat-1",
    mimeType: kind === "video" ? "video/mp4" : "image/jpeg",
    kind,
    sizeBytes: 100,
    width: 640,
    height: 480,
    sortOrder: 0,
    url: `/media/${id}`,
    thumbnailUrl: `/media/${id}/thumbnail`,
  };
}

describe("MediaGallery", () => {
  it("添付がなければ何も描画しない", () => {
    const { container } = render(<MediaGallery assets={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("サムネイルをクリックすると元データをモーダルで表示し、前後に移動できる", () => {
    render(
      <MediaGallery assets={[asset("a"), asset("b", "video")]} title="写真" />,
    );

    fireEvent.click(screen.getByRole("button", { name: "写真 1 を表示" }));
    const dialog = screen.getByRole("dialog", { name: "写真 1 / 2" });
    expect(dialog.querySelector("img")?.getAttribute("src")).toBe("/media/a");

    fireEvent.click(screen.getByRole("button", { name: "次へ" }));
    expect(
      screen.getByRole("dialog", { name: "写真 2 / 2" }).querySelector("video"),
    ).toHaveAttribute("src", "/media/b");
    expect(screen.getByRole("button", { name: "次へ" })).toBeDisabled();
  });
});
