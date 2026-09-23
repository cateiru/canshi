"use client";

import { useRouter } from "next/navigation";
import { useActionState, useRef } from "react";
import { MEDIA_ASSET_IDS_FIELD, MEDIA_FIELD_MARKER } from "./formFields";
import type { MediaAttachmentsController } from "./useMediaAttachments";

/**
 * 添付付きフォームの Server Action が返す状態。
 * 記録の保存に成功したら `savedRecordId` を返し、リダイレクトはクライアント側で行う。
 * 記録は保存できたが添付の紐付けに失敗した場合は `savedRecordId` と `formError` の両方を返す
 */
export type MediaFormState = {
  formError?: string;
  savedRecordId?: string;
};

export type MediaFormAction<S extends MediaFormState> = (
  state: S,
  formData: FormData,
) => Promise<S>;

export type UseMediaFormActionOptions<S extends MediaFormState> = {
  /** 新規作成・更新の Server Action */
  action: MediaFormAction<S>;
  /**
   * 新規作成で添付の紐付けに失敗した後の再送信で使う更新 Action。
   * 未指定の場合、再送信は `action` をそのまま呼ぶ（更新フォームでは不要）
   */
  updateAction?: (recordId: string) => MediaFormAction<S>;
  initialState: S;
  media: MediaAttachmentsController;
  /** 記録とメディアの保存がすべて完了したときの遷移先 */
  redirectTo: string;
};

/**
 * `useActionState` をラップし、添付のアップロード完了を待ってから記録を保存し、画面遷移する。
 * 添付はファイルを選んだ時点で下書きとしてアップロード済みのため、送信時は asset ID だけを送る。
 * アップロードに失敗したファイルが残っている場合は送信せず、再試行か取り消しを促す
 */
export function useMediaFormAction<S extends MediaFormState>({
  action,
  updateAction,
  initialState,
  media,
  redirectTo,
}: UseMediaFormActionOptions<S>) {
  const router = useRouter();
  // 新規作成に成功した記録の ID。
  // 再送信で入力エラーになると Action の返す状態は `savedRecordId` を含まなくなるため、
  // 状態とは別に保持して以後の送信では必ず同じ記録を更新する（記録の重複作成を防ぐ）
  const savedRecordIdRef = useRef<string | null>(null);

  return useActionState<S, FormData>(
    async (previousState, formData) => {
      const previous = previousState as S;
      // 選んだ直後に保存された場合もあるため、進行中のアップロードが終わるのを待つ
      const { assetIds, failed } = await media.waitForUploads();
      if (failed.length > 0) {
        return {
          ...previous,
          formError: `${failed.length} 件の添付をアップロードできませんでした。再試行するか取り消してから、もう一度保存してください`,
        };
      }
      formData.delete(MEDIA_ASSET_IDS_FIELD);
      for (const assetId of assetIds) {
        formData.append(MEDIA_ASSET_IDS_FIELD, assetId);
      }
      formData.set(MEDIA_FIELD_MARKER, "1");

      // 新規作成後に添付の紐付けだけ失敗した場合、再送信で記録を二重に作らないよう更新 Action に切り替える
      const savedRecordId = savedRecordIdRef.current;
      const effectiveAction =
        savedRecordId && updateAction ? updateAction(savedRecordId) : action;
      const result = await effectiveAction(previous, formData);
      if (!result.savedRecordId) {
        return result;
      }
      savedRecordIdRef.current = result.savedRecordId;
      if (result.formError) {
        return result;
      }

      router.push(redirectTo);
      return result;
      // S は Promise ではない状態オブジェクトなので Awaited<S> と同じ型として扱う
    },
    initialState as Awaited<S>,
  );
}
