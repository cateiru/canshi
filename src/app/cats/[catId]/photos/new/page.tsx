import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ui";
import { PhotoIcon } from "@/components/ui/RecordIcons/RecordIcons";
import {
  createCatPhotoAction,
  updateCatPhotoAction,
} from "@/features/cat-photos/actions";
import { CatPhotoForm } from "@/features/cat-photos/CatPhotoForm";
import { getCatById } from "@/features/cats/queries";
import { resolveMediaLimits } from "@/features/media/limits";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import styles from "../page.module.css";

export const dynamic = "force-dynamic";

type NewCatPhotoPageProps = {
  params: Promise<{ catId: string }>;
};

export default async function NewCatPhotoPage({
  params,
}: NewCatPhotoPageProps) {
  const { catId } = await params;
  const cat = await getCatById(catId);

  if (!cat) {
    notFound();
  }

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/home" },
          { label: "猫一覧", href: "/cats" },
          { label: cat.name, href: `/cats/${catId}` },
          { label: "写真", href: `/cats/${catId}/photos` },
          { label: "登録する" },
        ]}
      />

      <RecordPageHeading icon={PhotoIcon}>
        {cat.name}の写真を追加する
      </RecordPageHeading>
      <CatPhotoForm
        catId={catId}
        action={createCatPhotoAction.bind(null, catId)}
        updateAction={updateCatPhotoAction.bind(null, catId)}
        mediaLimits={resolveMediaLimits()}
        submitLabel="登録する"
      />
    </main>
  );
}
