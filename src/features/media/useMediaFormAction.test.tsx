import { act, render, waitFor } from "@testing-library/react";
import { startTransition } from "react";
import { describe, expect, it, vi } from "vitest";
import type { MediaAttachmentsController } from "./useMediaAttachments";
import { type MediaFormState, useMediaFormAction } from "./useMediaFormAction";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

type Submit = (formData: FormData) => void;

function Harness({
  action,
  updateAction,
  commit,
  onReady,
}: {
  action: (
    state: MediaFormState,
    formData: FormData,
  ) => Promise<MediaFormState>;
  updateAction: (recordId: string) => typeof action;
  commit: MediaAttachmentsController["commit"];
  onReady: (submit: Submit, getState: () => MediaFormState) => void;
}) {
  const [state, formAction] = useMediaFormAction<MediaFormState>({
    action,
    updateAction,
    initialState: {},
    recordType: "poop_record",
    media: { commit } as unknown as MediaAttachmentsController,
    redirectTo: "/done",
  });
  onReady(
    (formData) => startTransition(() => formAction(formData)),
    () => state,
  );
  return <output>{state.formError ?? ""}</output>;
}

describe("useMediaFormAction", () => {
  it("添付失敗後の再送信で入力エラーになっても、次の送信は同じ記録の更新になる", async () => {
    const createAction = vi.fn(async () => ({ savedRecordId: "rec-1" }));
    const update = vi
      .fn<
        (state: MediaFormState, formData: FormData) => Promise<MediaFormState>
      >()
      // 1 回目の再送信: 入力エラー
      .mockResolvedValueOnce({ formError: "入力に誤りがあります" })
      // 2 回目の再送信: 成功
      .mockResolvedValueOnce({ savedRecordId: "rec-1" });
    const updateAction = vi.fn((_recordId: string) => update);
    const commit = vi
      .fn<MediaAttachmentsController["commit"]>()
      // 新規作成直後のアップロードは失敗する
      .mockResolvedValueOnce({
        failed: [{ fileName: "a.jpg", error: "失敗" }],
      })
      .mockResolvedValue({ failed: [] });

    let submit: Submit = () => {};
    let getState: () => MediaFormState = () => ({});
    render(
      <Harness
        action={createAction}
        updateAction={updateAction}
        commit={commit}
        onReady={(s, g) => {
          submit = s;
          getState = g;
        }}
      />,
    );

    // 1 回目: 新規作成に成功するが添付の保存に失敗する
    await act(async () => submit(new FormData()));
    await waitFor(() => expect(getState().savedRecordId).toBe("rec-1"));
    expect(createAction).toHaveBeenCalledTimes(1);
    expect(getState().formError).toContain("添付を保存できませんでした");

    // 2 回目: 更新 Action が入力エラーを返し、状態から savedRecordId が消える
    await act(async () => submit(new FormData()));
    await waitFor(() =>
      expect(getState().formError).toBe("入力に誤りがあります"),
    );
    expect(getState().savedRecordId).toBeUndefined();
    expect(updateAction).toHaveBeenLastCalledWith("rec-1");

    // 3 回目: それでも新規作成には戻らず、同じ記録の更新 Action が呼ばれる
    await act(async () => submit(new FormData()));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(2));
    expect(updateAction).toHaveBeenLastCalledWith("rec-1");
    expect(createAction).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledTimes(2);
  });
});
