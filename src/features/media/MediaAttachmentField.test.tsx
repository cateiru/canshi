import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_MEDIA_LIMITS } from "./limits";
import { MediaAttachmentField } from "./MediaAttachmentField";
import type { UploadPendingMediaOptions } from "./upload";
import {
  type MediaAttachmentsController,
  useMediaAttachments,
} from "./useMediaAttachments";
import type { MediaAssetView } from "./view";

const { uploadPendingMedia, discardPendingMediaAction } = vi.hoisted(() => ({
  uploadPendingMedia:
    vi.fn<
      (file: File, options?: UploadPendingMediaOptions) => Promise<unknown>
    >(),
  discardPendingMediaAction: vi.fn(async (_assetId: string) => ({})),
}));

vi.mock("./upload", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./upload")>()),
  uploadPendingMedia,
}));

vi.mock("./actions", () => ({ discardPendingMediaAction }));

function Harness({
  initial = [],
  allowVideo = false,
  maxCount,
  onController,
}: {
  initial?: MediaAssetView[];
  allowVideo?: boolean;
  maxCount?: number;
  onController?: (controller: MediaAttachmentsController) => void;
}) {
  const controller = useMediaAttachments({
    initial,
    limits: { ...DEFAULT_MEDIA_LIMITS, maxImageBytes: 1000 },
    allowVideo,
    maxCount,
  });
  onController?.(controller);
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

function draftOf(id: string): MediaAssetView {
  return {
    ...existingAsset,
    id,
    recordType: "pending",
    recordId: id,
    catId: null,
  };
}

/** 呼び出しごとに解決・失敗を外から操作できるアップロードの偽物 */
function deferredUploads() {
  const calls: {
    file: File;
    options?: UploadPendingMediaOptions;
    resolve: (asset: MediaAssetView) => void;
    reject: (error: Error) => void;
  }[] = [];
  uploadPendingMedia.mockImplementation(
    (file, options) =>
      new Promise((resolve, reject) => {
        calls.push({ file, options, resolve, reject });
      }),
  );
  return calls;
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
    uploadPendingMedia.mockReset();
    discardPendingMediaAction.mockClear();
  });

  it("選択したファイルをプレビューし、取り消せる", () => {
    deferredUploads();
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
    deferredUploads();
    render(<Harness initial={[existingAsset]} maxCount={1} />);

    fireEvent.change(screen.getByLabelText("写真"), {
      target: { files: [imageFile("new.png")] },
    });

    expect(screen.queryByRole("img", { name: "添付 1" })).toBeNull();
    expect(screen.getByRole("img", { name: "new.png" })).toBeInTheDocument();
  });

  it("選択した時点で 1 件ずつアップロードし、進捗を表示する", async () => {
    const calls = deferredUploads();
    let controller: MediaAttachmentsController | undefined;
    render(<Harness onController={(c) => (controller = c)} />);

    fireEvent.change(screen.getByLabelText("写真"), {
      target: { files: [imageFile("a.png"), imageFile("b.png")] },
    });

    // 直列にアップロードするため、2 件目は 1 件目が終わるまで待機する
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(
      screen.getByRole("progressbar", { name: "b.png のアップロード" }),
    ).toHaveAttribute("aria-valuenow", "0");
    expect(screen.getByText("待機中")).toBeInTheDocument();

    act(() => calls[0].options?.onProgress?.(0.42));
    expect(
      screen.getByRole("progressbar", { name: "a.png のアップロード" }),
    ).toHaveAttribute("aria-valuenow", "42");
    expect(screen.getByText("42%")).toBeInTheDocument();
    expect(controller?.isUploading).toBe(true);

    await act(async () => calls[0].resolve(draftOf("draft-a")));
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(
      screen.queryByRole("progressbar", { name: "a.png のアップロード" }),
    ).toBeNull();

    const summary = controller?.waitForUploads();
    await act(async () => calls[1].resolve(draftOf("draft-b")));
    await expect(summary).resolves.toEqual({
      assetIds: ["draft-a", "draft-b"],
      failed: [],
    });
  });

  it("保存時の asset ID は既存（削除予定を除く）→ 新規の順になる", async () => {
    const calls = deferredUploads();
    let controller: MediaAttachmentsController | undefined;
    render(
      <Harness
        initial={[existingAsset, { ...draftOf("asset-2"), sortOrder: 1 }]}
        onController={(c) => (controller = c)}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "添付 1 を削除" }));
    fireEvent.change(screen.getByLabelText("写真"), {
      target: { files: [imageFile("a.png")] },
    });
    await waitFor(() => expect(calls).toHaveLength(1));
    await act(async () => calls[0].resolve(draftOf("draft-a")));

    await expect(controller?.waitForUploads()).resolves.toEqual({
      assetIds: ["asset-2", "draft-a"],
      failed: [],
    });
  });

  it("失敗したアップロードは再試行でき、取り消すとアップロード済みの下書きを削除する", async () => {
    const calls = deferredUploads();
    let controller: MediaAttachmentsController | undefined;
    render(<Harness onController={(c) => (controller = c)} />);

    fireEvent.change(screen.getByLabelText("写真"), {
      target: { files: [imageFile("a.png")] },
    });
    await waitFor(() => expect(calls).toHaveLength(1));
    await act(async () => calls[0].reject(new Error("通信に失敗しました")));

    expect(await screen.findByText("通信に失敗しました")).toBeInTheDocument();
    await expect(controller?.waitForUploads()).resolves.toEqual({
      assetIds: [],
      failed: [{ fileName: "a.png", error: "通信に失敗しました" }],
    });

    fireEvent.click(screen.getByRole("button", { name: "a.png を再試行" }));
    await waitFor(() => expect(calls).toHaveLength(2));
    await act(async () => calls[1].resolve(draftOf("draft-a")));
    await waitFor(() => expect(controller?.isUploading).toBe(false));
    expect(screen.queryByText("通信に失敗しました")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "a.png を取り消す" }));
    expect(discardPendingMediaAction).toHaveBeenCalledWith("draft-a");
    await expect(controller?.waitForUploads()).resolves.toEqual({
      assetIds: [],
      failed: [],
    });
  });

  it("ドラッグ＆ドロップでファイルを追加できる", async () => {
    deferredUploads();
    const { container } = render(<Harness />);
    const field = container.firstElementChild as HTMLElement;
    const dataTransfer = {
      types: ["Files"],
      files: [imageFile("dropped.png")],
      dropEffect: "none",
    };

    fireEvent.dragEnter(field, { dataTransfer });
    expect(field).toHaveAttribute("data-dragging", "true");
    fireEvent.drop(field, { dataTransfer });

    expect(field).not.toHaveAttribute("data-dragging");
    expect(
      screen.getByRole("img", { name: "dropped.png" }),
    ).toBeInTheDocument();
  });

  it("1 枚制限では未選択時にドロップ領域、選択後に差し替えボタンを表示し、ドロップは先頭の 1 枚だけ使う", () => {
    deferredUploads();
    const { container } = render(<Harness maxCount={1} />);

    expect(screen.getByText("画像を選ぶ")).toBeInTheDocument();
    expect(screen.queryByText("追加する")).toBeNull();

    fireEvent.drop(container.firstElementChild as HTMLElement, {
      dataTransfer: {
        types: ["Files"],
        files: [imageFile("first.png"), imageFile("second.png")],
      },
    });

    expect(screen.getByRole("img", { name: "first.png" })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "second.png" })).toBeNull();
    expect(screen.queryByText("画像を選ぶ")).toBeNull();
    expect(screen.getByText("差し替える")).toBeInTheDocument();
  });
});
