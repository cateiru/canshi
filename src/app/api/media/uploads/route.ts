import {
  deleteStalePendingMediaAssets,
  MediaUploadError,
  storePendingMediaAsset,
} from "@/features/media/storage";
import { toMediaAssetView } from "@/features/media/view";

export const dynamic = "force-dynamic";

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

/**
 * フォームでファイルを選んだ時点で呼ぶ、記録に紐付けない下書きのアップロード。
 * multipart/form-data で次のフィールドを受け取る。
 *
 * - `file`：本体（必須）
 * - `thumbnail`：ブラウザ側で縮小したサムネイル候補（動画では切り出したフレーム画像。動画では必須、画像では任意）
 *
 * 返した asset ID をフォームの送信時に渡すと、記録の保存と同時に紐付く（`syncRecordMedia`）。
 * 紐付かないまま放置された下書きは、次回以降のアップロード時に削除する
 */
export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError("リクエストの形式が正しくありません", 400);
  }

  const file = formData.get("file");
  const thumbnail = formData.get("thumbnail");
  if (!(file instanceof Blob)) {
    return jsonError("ファイルが指定されていません", 400);
  }

  try {
    // 放置された下書きも保存容量に数えるため、容量の判定より先に片付ける
    await deleteStalePendingMediaAssets().catch((error) => {
      console.error("古い下書きの削除に失敗しました", error);
    });
    const asset = await storePendingMediaAsset({
      file,
      thumbnail: thumbnail instanceof Blob ? thumbnail : null,
    });
    return Response.json({ asset: toMediaAssetView(asset) }, { status: 201 });
  } catch (error) {
    if (error instanceof MediaUploadError) {
      return jsonError(error.message, error.status);
    }
    console.error("メディアのアップロードに失敗しました", error);
    return jsonError("アップロードに失敗しました", 500);
  }
}
