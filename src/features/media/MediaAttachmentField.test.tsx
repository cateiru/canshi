import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_MEDIA_LIMITS } from "./limits";
import { MediaAttachmentField } from "./MediaAttachmentField";
import { useMediaAttachments } from "./useMediaAttachments";
import type { MediaAssetView } from "./view";

function Harness({
  initial = [],
  allowVideo = false,
  maxCount,
}: {
  initial?: MediaAssetView[];
  allowVideo?: boolean;
  maxCount?: number;
}) {
  const controller = useMediaAttachments({
    initial,
    limits: { ...DEFAULT_MEDIA_LIMITS, maxImageBytes: 1000 },
    allowVideo,
    maxCount,
  });
  return (
    <MediaAttachmentField
      controller={controller}
      allowVideo={allowVideo}
      single={maxCount === 1}
    />
  );
}

const existingAsset: MediaAssetView = {
  id: "asset-1",
  recordType: "poop_record",
  recordId: "rec-1",
  catId: "cat-1",
  mimeType: "image/jpeg",
  kind: "image",
  sizeBytes: 100,
  width: 640,
  height: 480,
  sortOrder: 0,
  url: "/media/asset-1",
  thumbnailUrl: "/media/asset-1/thumbnail",
};

function imageFile(name: string, size = 100) {
  return new File([new Uint8Array(size)], name, { type: "image/png" });
}

describe("MediaAttachmentField", () => {
  beforeEach(() => {
    // jsdom には Object URL がないため差し替える
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:preview"),
      revokeObjectURL: vi.fn(),
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("選択したファイルをプレビューし、取り消せる", () => {
    render(<Harness />);

    fireEvent.change(screen.getByLabelText("写真"), {
      target: { files: [imageFile("a.png"), imageFile("b.png")] },
    });

    expect(screen.getByRole("img", { name: "a.png" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "b.png" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "a.png を取り消す" }));
    expect(screen.queryByRole("img", { name: "a.png" })).toBeNull();
    expect(screen.getByRole("img", { name: "b.png" })).toBeInTheDocument();
  });

  it("上限を超えるファイルはエラーを表示して追加しない", () => {
    render(<Harness />);

    fireEvent.change(screen.getByLabelText("写真"), {
      target: { files: [imageFile("big.png", 1001)] },
    });

    expect(screen.getByRole("alert")).toHaveTextContent("big.png：画像は");
    expect(screen.queryByRole("img", { name: "big.png" })).toBeNull();
  });

  it("既存の添付を削除予定にできる", () => {
    render(<Harness initial={[existingAsset]} />);

    expect(screen.getByRole("img", { name: "添付 1" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "添付 1 を削除" }));
    expect(screen.queryByRole("img", { name: "添付 1" })).toBeNull();
  });

  it("1 枚制限では新しい選択で既存を置き換える", () => {
    render(<Harness initial={[existingAsset]} maxCount={1} />);

    fireEvent.change(screen.getByLabelText("写真"), {
      target: { files: [imageFile("new.png")] },
    });

    expect(screen.queryByRole("img", { name: "添付 1" })).toBeNull();
    expect(screen.getByRole("img", { name: "new.png" })).toBeInTheDocument();
  });
});
