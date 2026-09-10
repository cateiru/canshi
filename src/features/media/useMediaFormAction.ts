"use client";

import { useRouter } from "next/navigation";
import { useActionState, useRef } from "react";
import type {
  MediaAttachmentsController,
  MediaCommitTarget,
} from "./useMediaAttachments";

/**
 * 添付付きフォームの Server Action が返す状態。
 * 記録の保存に成功したら `savedRecordId` を返し、リダイレクトはクライアント側で行う
 * （保存後に確定した記録 ID でアップロード API を呼ぶ必要があるため）
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
   * 新規作成でアップロードに失敗した後の再送信で使う更新 Action。
   * 未指定の場合、再送信は `action` をそのまま呼ぶ（更新フォームでは不要）
   */
  updateAction?: (recordId: string) => MediaFormAction<S>;
  initialState: S;
  recordType: MediaCommitTarget["recordType"];
  media: MediaAttachmentsController;
  /** 記録とメディアの保存がすべて完了したときの遷移先 */
  redirectTo: string;
};

/**
 * `useActionState` をラップし、記録の保存 → メディアの削除・アップロード → 画面遷移を 1 回の送信で行う。
 * アップロードに一部失敗した場合は画面に留まり、失敗したファイルを残して再送信できるようにする
 */
export function useMediaFormAction<S extends MediaFormState>({
  action,
  updateAction,
  initialState,
  recordType,
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
      // 新規作成後にアップロードだけ失敗した場合、再送信で記録を二重に作らないよう更新 Action に切り替える
      const savedRecordId = savedRecordIdRef.current;
      const effectiveAction =
        savedRecordId && updateAction ? updateAction(savedRecordId) : action;
      const result = await effectiveAction(previous, formData);
      if (!result.savedRecordId) {
        return result;
      }
      savedRecordIdRef.current = result.savedRecordId;

      const { failed } = await media.commit({
        recordType,
        recordId: result.savedRecordId,
      });
      if (failed.length > 0) {
        return {
          ...result,
          formError: `記録は保存しましたが、${failed.length} 件の添付を保存できませんでした。内容を確認して、もう一度保存してください`,
        };
      }

      router.push(redirectTo);
      return result;
      // S は Promise ではない状態オブジェクトなので Awaited<S> と同じ型として扱う
    },
    initialState as Awaited<S>,
  );
}
