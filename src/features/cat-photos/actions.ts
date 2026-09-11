"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { catPhotos, cats, mediaAssets } from "@/db/schema";
import {
  clampCropPercent,
  type ProfileCrop,
} from "@/features/cats/profileCrop";
import { syncCatProfileImage } from "@/features/cats/profileImage";
import { deleteMediaAssetsByRecord } from "@/features/media/storage";
import type { MediaFormState } from "@/features/media/useMediaFormAction";
import { combineDateTimeUtc } from "@/features/shared/datetime";
import { CAT_PHOTO_MEDIA_TYPE } from "./media";
import { type CatPhotoFormFieldErrors, catPhotoFormSchema } from "./schema";

/**
 * 保存に成功すると `savedRecordId` を返す。写真のアップロードと一覧への遷移は
 * クライアント側（useMediaFormAction）が行うため、ここではリダイレクトしない。
 * プロフィール画像の自動更新は、アップロード API が写真の保存後に行う
 */
export type CatPhotoFormState = MediaFormState & {
  fieldErrors?: CatPhotoFormFieldErrors;
};

function parseFormData(formData: FormData) {
  return catPhotoFormSchema.safeParse({
    takenDate: formData.get("takenDate"),
    takenTime: formData.get("takenTime"),
    memo: formData.get("memo"),
  });
}

export async function createCatPhotoAction(
  catId: string,
  _prevState: CatPhotoFormState,
  formData: FormData,
): Promise<CatPhotoFormState> {
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const db = getDb();
  const [created] = await db
    .insert(catPhotos)
    .values({
      catId,
      takenAt: combineDateTimeUtc(parsed.data.takenDate, parsed.data.takenTime),
      memo: parsed.data.memo ?? null,
    })
    .returning({ id: catPhotos.id });

  return { savedRecordId: created.id };
}

export async function updateCatPhotoAction(
  catId: string,
  id: string,
  _prevState: CatPhotoFormState,
  formData: FormData,
): Promise<CatPhotoFormState> {
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const db = getDb();
  const result = await db
    .update(catPhotos)
    .set({
      takenAt: combineDateTimeUtc(parsed.data.takenDate, parsed.data.takenTime),
      memo: parsed.data.memo ?? null,
      updatedAt: new Date(),
    })
    .where(and(eq(catPhotos.id, id), eq(catPhotos.catId, catId)))
    .returning({ id: catPhotos.id });

  if (result.length === 0) {
    return { formError: "写真の記録が見つかりませんでした" };
  }

  // 撮影日時が変わると「最新の写真」も変わりうる
  await syncCatProfileImage(catId);

  return { savedRecordId: id };
}

export async function deleteCatPhotoAction(
  catId: string,
  id: string,
): Promise<void> {
  const db = getDb();
  // 紐付く写真（R2 のオブジェクトと media_assets 行）を先に削除する。
  // プロフィールに使っていた写真が消えた場合の付け替えは deleteMediaAssets 側で行う
  await deleteMediaAssetsByRecord(CAT_PHOTO_MEDIA_TYPE, id);
  await db
    .delete(catPhotos)
    .where(and(eq(catPhotos.id, id), eq(catPhotos.catId, catId)));
  await syncCatProfileImage(catId);
  redirect(`/cats/${catId}/photos`);
}

export type ProfileImageActionResult = { error?: string };

/**
 * 指定した写真をプロフィール画像として固定する。固定中は写真を追加しても自動更新しない。
 * crop は表示位置（object-position と同じ 0〜100 の百分率）
 */
export async function pinProfileImageAction(
  catId: string,
  assetId: string,
  crop: ProfileCrop,
): Promise<ProfileImageActionResult> {
  const db = getDb();
  const [asset] = await db
    .select({ id: mediaAssets.id })
    .from(mediaAssets)
    .where(
      and(
        eq(mediaAssets.id, assetId),
        eq(mediaAssets.catId, catId),
        eq(mediaAssets.recordType, CAT_PHOTO_MEDIA_TYPE),
      ),
    )
    .limit(1);
  if (!asset) {
    return { error: "写真が見つかりませんでした" };
  }
  await db
    .update(cats)
    .set({
      profileMediaAssetId: asset.id,
      isProfilePinned: true,
      profileCropX: clampCropPercent(crop.x),
      profileCropY: clampCropPercent(crop.y),
      updatedAt: new Date(),
    })
    .where(eq(cats.id, catId));
  return {};
}

/**
 * プロフィール画像の固定を解除し、最新の写真での自動更新に戻す
 */
export async function unpinProfileImageAction(
  catId: string,
): Promise<ProfileImageActionResult> {
  const db = getDb();
  await db
    .update(cats)
    .set({ isProfilePinned: false, updatedAt: new Date() })
    .where(eq(cats.id, catId));
  await syncCatProfileImage(catId);
  return {};
}
