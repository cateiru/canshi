import { notFound } from "next/navigation";
import { TbPhoto } from "react-icons/tb";
import { Breadcrumb, ButtonLink, Card } from "@/components/ui";
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
          { label: "トップ", href: "/" },
          { label: "猫一覧", href: "/cats" },
          { label: cat.name, href: `/cats/${catId}` },
          { label: "写真" },
        ]}
      />

      <div className={styles.header}>
        <RecordPageHeading icon={TbPhoto}>{cat.name}の写真</RecordPageHeading>
        <ButtonLink href={`/cats/${catId}/photos/new`} variant="primary">
          写真を追加する
        </ButtonLink>
      </div>

      <p className={styles.note}>
        {cat.isProfilePinned
          ? "プロフィール画像は固定中です。写真を開いて「固定を解除」すると最新の写真で自動更新されます。"
          : "最新の撮影日時の写真がプロフィール画像になります。写真を開いて「プロフィール画像にする」を押すと固定できます。"}
      </p>

      {photos.length === 0 ? (
        <Card>
          <p>まだ写真がありません。</p>
          <div className={styles.emptyActions}>
            <ButtonLink href={`/cats/${catId}/photos/new`} variant="primary">
              最初の写真を追加する
            </ButtonLink>
          </div>
        </Card>
      ) : (
        <ul className={styles.list}>
          {photos.map((photo) => (
            <li key={photo.id}>
              <Card title={formatDateTimeUtc(photo.takenAt)}>
                {photo.memo ? <p>{photo.memo}</p> : null}
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
                <div className={styles.cardActions}>
                  <ButtonLink
                    href={`/cats/${catId}/photos/${photo.id}/edit`}
                    variant="secondary"
                  >
                    編集する
                  </ButtonLink>
                  <DeleteRecordButton
                    action={deleteCatPhotoAction.bind(null, catId, photo.id)}
                    title="写真の削除"
                    description="この写真の記録を削除しますか？添付した写真もすべて削除されます。この操作は取り消せません。"
                  />
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
