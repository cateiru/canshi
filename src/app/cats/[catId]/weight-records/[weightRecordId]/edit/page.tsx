import { WeightIcon } from "@canshi/shared/ui/RecordIcons";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ui";
import { getWritableCat } from "@/features/auth/presentation/session";
import { catPageMetadata } from "@/features/cats/presentation/catPageMetadata";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import { getWeightRecordById } from "@/features/weight-records/infrastructure/queries";
import { updateWeightRecordAction } from "@/features/weight-records/presentation/actions";
import { WeightRecordForm } from "@/features/weight-records/presentation/WeightRecordForm";
import styles from "../../page.module.css";

export const dynamic = "force-dynamic";

export const generateMetadata = catPageMetadata(
  (catName) => `${catName}の体重記録を編集する`,
);

type EditWeightRecordPageProps = {
  params: Promise<{ catId: string; weightRecordId: string }>;
};

export default async function EditWeightRecordPage({
  params,
}: EditWeightRecordPageProps) {
  const { catId, weightRecordId } = await params;
  const [cat, weightRecord] = await Promise.all([
    getWritableCat(catId),
    getWeightRecordById(weightRecordId),
  ]);

  if (!cat || !weightRecord || weightRecord.catId !== catId) {
    notFound();
  }

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/home" },
          { label: "ねこ一覧", href: "/cats" },
          { label: cat.name, href: `/cats/${catId}` },
          { label: "体重記録", href: `/cats/${catId}/weight-records` },
          { label: "編集する" },
        ]}
      />

      <RecordPageHeading icon={WeightIcon}>
        {cat.name}の体重記録を編集する
      </RecordPageHeading>
      <WeightRecordForm
        action={updateWeightRecordAction.bind(null, catId, weightRecord.id)}
        weightRecord={weightRecord}
        submitLabel="更新する"
      />
    </main>
  );
}
