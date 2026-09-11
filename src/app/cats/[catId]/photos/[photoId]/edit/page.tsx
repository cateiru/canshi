import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ui";
import { updateCatPhotoAction } from "@/features/cat-photos/actions";
import { CatPhotoForm } from "@/features/cat-photos/CatPhotoForm";
import { CAT_PHOTO_MEDIA_TYPE } from "@/features/cat-photos/media";
import { getCatPhotoById } from "@/features/cat-photos/queries";
import { getCatById } from "@/features/cats/queries";
import { resolveMediaLimits } from "@/features/media/limits";
import { listMediaAssetsByRecord } from "@/features/media/queries";
import { toMediaAssetView } from "@/features/media/view";
import styles from "../../page.module.css";

export const dynamic = "force-dynamic";

type EditCatPhotoPageProps = {
  params: Promise<{ catId: string; photoId: string }>;
};

export default async function EditCatPhotoPage({
  params,
}: EditCatPhotoPageProps) {
  const { catId, photoId } = await params;
  const [cat, catPhoto] = await Promise.all([
    getCatById(catId),
    getCatPhotoById(photoId),
  ]);

  if (!cat || !catPhoto || catPhoto.catId !== catId) {
    notFound();
  }

  const mediaAssets = await listMediaAssetsByRecord(
    CAT_PHOTO_MEDIA_TYPE,
    catPhoto.id,
  );

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/home" },
          { label: "猫一覧", href: "/cats" },
          { label: cat.name, href: `/cats/${catId}` },
          { label: "写真", href: `/cats/${catId}/photos` },
          { label: "編集する" },
        ]}
      />

      <h1>{cat.name}の写真を編集する</h1>
      <CatPhotoForm
        catId={catId}
        action={updateCatPhotoAction.bind(null, catId, catPhoto.id)}
        catPhoto={catPhoto}
        mediaAssets={mediaAssets.map(toMediaAssetView)}
        mediaLimits={resolveMediaLimits()}
        submitLabel="更新する"
      />
    </main>
  );
}
