import { requireUser } from "@/features/auth/presentation/session";
import { syncRecordMedia } from "../application/attach";
import { parseMediaAssetIds } from "../domain/formFields";
import type { MediaRecordType } from "../domain/recordTypes";

/**
 * Server Action から呼ぶ。フォームの添付を記録に反映し、失敗したらフォーム用のエラーメッセージを返す
 */
export async function syncRecordMediaFromForm(
  recordType: MediaRecordType,
  recordId: string,
  formData: FormData,
): Promise<string | undefined> {
  // 記録への認可は呼び出し元の Server Action と `syncRecordMedia` で行うため、ここではログイン中の
  // ユーザーを引くだけ（requireUser は未ログイン時にリダイレクト＝例外にするため、try の外で呼ぶ）
  const user = await requireUser();
  try {
    const result = await syncRecordMedia(
      recordType,
      recordId,
      parseMediaAssetIds(formData),
      user.id,
    );
    return result.error ? `記録は保存しましたが、${result.error}` : undefined;
  } catch (error) {
    console.error("添付の保存に失敗しました", error);
    return "記録は保存しましたが、添付を保存できませんでした。もう一度保存してください";
  }
}
