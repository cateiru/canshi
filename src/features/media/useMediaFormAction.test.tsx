import { act, render, waitFor } from "@testing-library/react";
import { startTransition } from "react";
import { describe, expect, it, vi } from "vitest";
import { MEDIA_ASSET_IDS_FIELD, MEDIA_FIELD_MARKER } from "./formFields";
import type {
  MediaAttachmentsController,
  MediaUploadSummary,
} from "./useMediaAttachments";
import { type MediaFormState, useMediaFormAction } from "./useMediaFormAction";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
}));

type Submit = (formData: FormData) => void;
type Action = (
  state: MediaFormState,
  formData: FormData,
) => Promise<MediaFormState>;

function Harness({
  action,
  updateAction,
  waitForUploads,
  onReady,
}: {
  action: Action;
  updateAction?: (recordId: string) => Action;
  waitForUploads: () => Promise<MediaUploadSummary>;
  onReady: (submit: Submit, getState: () => MediaFormState) => void;
}) {
  const [state, formAction] = useMediaFormAction<MediaFormState>({
    action,
    updateAction,
    initialState: {},
    media: { waitForUploads } as unknown as MediaAttachmentsController,
    redirectTo: "/done",
  });
  onReady(
    (formData) => startTransition(() => formAction(formData)),
    () => state,
  );
  return <output>{state.formError ?? ""}</output>;
}

function setup(props: Omit<Parameters<typeof Harness>[0], "onReady">) {
  let submit: Submit = () => {};
  let getState: () => MediaFormState = () => ({});
  render(
    <Harness
      {...props}
      onReady={(s, g) => {
        submit = s;
        getState = g;
      }}
    />,
  );
  return {
    submit: (formData = new FormData()) => submit(formData),
    getState: () => getState(),
  };
}

describe("useMediaFormAction", () => {
  it("アップロードの完了を待ち、asset ID を表示順に詰めて送信する", async () => {
    push.mockClear();
    const action = vi.fn<Action>(async () => ({ savedRecordId: "rec-1" }));
    let finishUploads: (summary: MediaUploadSummary) => void = () => {};
    const waitForUploads = vi.fn(
      () =>
        new Promise<MediaUploadSummary>((resolve) => {
          finishUploads = resolve;
        }),
    );
    const { submit } = setup({ action, waitForUploads });

    const formData = new FormData();
    // 古い値が残っていても送信時の一覧で置き換える
    formData.append(MEDIA_ASSET_IDS_FIELD, "stale");
    await act(async () => submit(formData));
    expect(action).not.toHaveBeenCalled();

    await act(async () =>
      finishUploads({ assetIds: ["asset-2", "draft-1"], failed: [] }),
    );
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const sent = action.mock.calls[0][1];
    expect(sent.getAll(MEDIA_ASSET_IDS_FIELD)).toEqual(["asset-2", "draft-1"]);
    expect(sent.get(MEDIA_FIELD_MARKER)).toBe("1");
    await waitFor(() => expect(push).toHaveBeenCalledWith("/done"));
  });

  it("アップロードに失敗したファイルがあれば送信しない", async () => {
    const action = vi.fn<Action>(async () => ({ savedRecordId: "rec-1" }));
    const waitForUploads = vi.fn(async () => ({
      assetIds: [],
      failed: [{ fileName: "a.png", error: "失敗" }],
    }));
    const { submit, getState } = setup({ action, waitForUploads });

    await act(async () => submit());
    await waitFor(() =>
      expect(getState().formError).toContain(
        "1 件の添付をアップロードできませんでした",
      ),
    );
    expect(action).not.toHaveBeenCalled();
  });

  it("添付の紐付け失敗後の再送信で入力エラーになっても、次の送信は同じ記録の更新になる", async () => {
    push.mockClear();
    const createAction = vi.fn<Action>(async () => ({
      savedRecordId: "rec-1",
      formError: "記録は保存しましたが、添付を保存できませんでした",
    }));
    const update = vi
      .fn<Action>()
      // 1 回目の再送信: 入力エラー
      .mockResolvedValueOnce({ formError: "入力に誤りがあります" })
      // 2 回目の再送信: 成功
      .mockResolvedValueOnce({ savedRecordId: "rec-1" });
    const updateAction = vi.fn((_recordId: string) => update);
    const waitForUploads = vi.fn(async () => ({ assetIds: [], failed: [] }));
    const { submit, getState } = setup({
      action: createAction,
      updateAction,
      waitForUploads,
    });

    // 1 回目: 新規作成に成功するが添付の紐付けに失敗する（画面に留まる）
    await act(async () => submit());
    await waitFor(() => expect(getState().savedRecordId).toBe("rec-1"));
    expect(getState().formError).toContain("添付を保存できませんでした");
    expect(push).not.toHaveBeenCalled();

    // 2 回目: 更新 Action が入力エラーを返し、状態から savedRecordId が消える
    await act(async () => submit());
    await waitFor(() =>
      expect(getState().formError).toBe("入力に誤りがあります"),
    );
    expect(getState().savedRecordId).toBeUndefined();
    expect(updateAction).toHaveBeenLastCalledWith("rec-1");

    // 3 回目: それでも新規作成には戻らず、同じ記録の更新 Action が呼ばれる
    await act(async () => submit());
    await waitFor(() => expect(update).toHaveBeenCalledTimes(2));
    expect(updateAction).toHaveBeenLastCalledWith("rec-1");
    expect(createAction).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/done"));
  });
});
