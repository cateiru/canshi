import { notFound } from "next/navigation";
import { TbClock, TbPencil, TbPhoto, TbPlus } from "react-icons/tb";
import { Breadcrumb, ButtonLink } from "@/components/ui";
import {
  deleteCatPhotoAction,
  pinProfileImageAction,
  unpinProfileImageAction,
} from "@/features/cat-photos/actions";
import { CatPhotoGallery } from "@/features/cat-photos/CatPhotoGallery";
import { CAT_PHOTO_MEDIA_TYPE } from "@/features/cat-photos/media";
import { listCatPhotos } from "@/features/cat-photos/queries";
import { getCatById } from "@/features/cats/queries";
import { listMediaAssetsByRecords } from "@/features/media/queries";
import { toMediaAssetView } from "@/features/media/view";
import { DeleteRecordButton } from "@/features/shared/DeleteRecordButton";
import { formatDateTimeUtc } from "@/features/shared/datetime";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type CatPhotosPageProps = {
  params: Promise<{ catId: string }>;
};

export default async function CatPhotosPage({ params }: CatPhotosPageProps) {
  const { catId } = await params;
  const cat = await getCatById(catId);

  if (!cat) {
    notFound();
  }

  const photos = await listCatPhotos(catId);
  const mediaByRecordId = await listMediaAssetsByRecords(
    CAT_PHOTO_MEDIA_TYPE,
    photos.map((photo) => photo.id),
  );

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/home" },
          { label: "猫一覧", href: "/cats" },
          { label: cat.name, href: `/cats/${catId}` },
          { label: "写真" },
        ]}
      />

      <div className={styles.header}>
        <RecordPageHeading icon={TbPhoto}>{cat.name}の写真</RecordPageHeading>
        <ButtonLink
          href={`/cats/${catId}/photos/new`}
          variant="primary"
          className={styles.createButton}
        >
          <TbPlus aria-hidden="true" size={18} />
          写真を追加する
        </ButtonLink>
      </div>

      <p className={styles.note}>
        {cat.isProfilePinned
          ? "プロフィール画像は固定中です。写真を開いて「固定を解除」すると最新の写真で自動更新されます。"
          : "最新の撮影日時の写真がプロフィール画像になります。写真を開いて「プロフィール画像にする」を押すと固定できます。"}
      </p>

      {photos.length === 0 ? (
        <div className={styles.emptyState}>
          <TbPhoto aria-hidden="true" size={32} />
          <p>まだ写真がありません。</p>
          <div className={styles.emptyActions}>
            <ButtonLink
              href={`/cats/${catId}/photos/new`}
              variant="primary"
              className={styles.createButton}
            >
              最初の写真を追加する
            </ButtonLink>
          </div>
        </div>
      ) : (
        <ul className={styles.list}>
          {photos.map((photo) => (
            <li key={photo.id}>
              <article
                className={styles.record}
                aria-label={formatDateTimeUtc(photo.takenAt)}
              >
                <div className={styles.recordHeader}>
                  <h2 className={styles.recordDate}>
                    <TbClock aria-hidden="true" size={18} />
                    <time dateTime={photo.takenAt.toISOString()}>
                      {formatDateTimeUtc(photo.takenAt)}
                    </time>
                  </h2>
                  <div className={styles.cardActions}>
                    <ButtonLink
                      href={`/cats/${catId}/photos/${photo.id}/edit`}
                      variant="secondary"
                      className={styles.iconButton}
                      aria-label="編集する"
                      title="編集する"
                    >
                      <TbPencil aria-hidden="true" size={20} />
                    </ButtonLink>
                    <DeleteRecordButton
                      action={deleteCatPhotoAction.bind(null, catId, photo.id)}
                      title="写真の削除"
                      description="この写真の記録を削除しますか？添付した写真もすべて削除されます。この操作は取り消せません。"
                      iconOnly
                      className={styles.iconButton}
                    />
                  </div>
                </div>

                {photo.memo ? (
                  <p className={styles.memo}>{photo.memo}</p>
                ) : null}

                <div className={styles.gallery}>
                  <CatPhotoGallery
                    assets={(mediaByRecordId.get(photo.id) ?? []).map(
                      toMediaAssetView,
                    )}
                    profileAssetId={cat.profileMediaAssetId}
                    isProfilePinned={cat.isProfilePinned}
                    profileCropX={cat.profileCropX}
                    profileCropY={cat.profileCropY}
                    pinAction={pinProfileImageAction.bind(null, catId)}
                    unpinAction={unpinProfileImageAction.bind(null, catId)}
                  />
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
