import { CAT_PHOTO_MEDIA_TYPE } from "@/features/cat-photos/media";
import { syncCatProfileImage } from "@/features/cats/profileImage";
import { resolveMediaRecordOwner } from "@/features/media/recordOwner";
import {
  DEV_MEDIA_RECORD_TYPE,
  isMediaRecordType,
} from "@/features/media/recordTypes";
import { MediaUploadError, storeMediaAsset } from "@/features/media/storage";
import { toMediaAssetView } from "@/features/media/view";

export const dynamic = "force-dynamic";

const RECORD_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

/**
 * メディアのアップロード。multipart/form-data で次のフィールドを受け取る。
 *
 * - `file`：本体（必須）
 * - `recordType`・`recordId`：添付先レコード（必須。レコードが実在することを確認する）
 * - `thumbnail`：動画の場合にブラウザ側で切り出したフレーム画像（動画では必須）
 */
export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError("リクエストの形式が正しくありません", 400);
  }

  const file = formData.get("file");
  const recordType = formData.get("recordType");
  const recordId = formData.get("recordId");
  const thumbnail = formData.get("thumbnail");

  if (!(file instanceof Blob)) {
    return jsonError("ファイルが指定されていません", 400);
  }
  if (typeof recordType !== "string" || typeof recordId !== "string") {
    return jsonError("添付先のレコードが指定されていません", 400);
  }
  if (!RECORD_ID_PATTERN.test(recordId)) {
    return jsonError("添付先のレコード ID が正しくありません", 400);
  }

  let catId: string | null;
  if (
    recordType === DEV_MEDIA_RECORD_TYPE &&
    process.env.NODE_ENV !== "production"
  ) {
    catId = null;
  } else {
    if (!isMediaRecordType(recordType)) {
      return jsonError("添付先のレコード種別が正しくありません", 400);
    }
    const owner = await resolveMediaRecordOwner(recordType, recordId);
    if (!owner) {
      return jsonError("添付先のレコードが見つかりませんでした", 404);
    }
    catId = owner.catId;
  }

  try {
    const asset = await storeMediaAsset({
      recordType,
      recordId,
      catId,
      file,
      thumbnail: thumbnail instanceof Blob ? thumbnail : null,
    });
    if (recordType === CAT_PHOTO_MEDIA_TYPE && catId) {
      // 写真を追加するたびに最新の写真でプロフィール画像を更新する（固定中は変更しない）
      await syncCatProfileImage(catId);
    }
    return Response.json({ asset: toMediaAssetView(asset) }, { status: 201 });
  } catch (error) {
    if (error instanceof MediaUploadError) {
      return jsonError(error.message, error.status);
    }
    console.error("メディアのアップロードに失敗しました", error);
    return jsonError("アップロードに失敗しました", 500);
  }
}
