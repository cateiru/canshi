import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ui";
import { ShampooIcon } from "@/components/ui/RecordIcons/RecordIcons";
import { getAccessibleCat } from "@/features/auth/presentation/session";
import { getShampooRecordById } from "@/features/shampoo-records/infrastructure/queries";
import { updateShampooRecordAction } from "@/features/shampoo-records/presentation/actions";
import { ShampooRecordForm } from "@/features/shampoo-records/presentation/ShampooRecordForm";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import styles from "../../page.module.css";

export const dynamic = "force-dynamic";

type EditShampooRecordPageProps = {
  params: Promise<{ catId: string; shampooRecordId: string }>;
};

export default async function EditShampooRecordPage({
  params,
}: EditShampooRecordPageProps) {
  const { catId, shampooRecordId } = await params;
  const [cat, shampooRecord] = await Promise.all([
    getAccessibleCat(catId),
    getShampooRecordById(shampooRecordId),
  ]);

  if (!cat || !shampooRecord || shampooRecord.catId !== catId) {
    notFound();
  }

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/home" },
          { label: "猫一覧", href: "/cats" },
          { label: cat.name, href: `/cats/${catId}` },
          { label: "シャンプー記録", href: `/cats/${catId}/shampoo-records` },
          { label: "編集する" },
        ]}
      />

      <RecordPageHeading icon={ShampooIcon}>
        {cat.name}のシャンプー記録を編集する
      </RecordPageHeading>
      <ShampooRecordForm
        action={updateShampooRecordAction.bind(null, catId, shampooRecord.id)}
        shampooRecord={shampooRecord}
        submitLabel="更新する"
      />
    </main>
  );
}
