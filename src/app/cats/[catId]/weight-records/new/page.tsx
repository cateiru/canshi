import { notFound } from "next/navigation";
import { TbWeight } from "react-icons/tb";
import { Breadcrumb } from "@/components/ui";
import { getCatById } from "@/features/cats/queries";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import { createWeightRecordAction } from "@/features/weight-records/actions";
import { WeightRecordForm } from "@/features/weight-records/WeightRecordForm";
import styles from "../page.module.css";

export const dynamic = "force-dynamic";

type NewWeightRecordPageProps = {
  params: Promise<{ catId: string }>;
};

export default async function NewWeightRecordPage({
  params,
}: NewWeightRecordPageProps) {
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
          { label: "体重記録", href: `/cats/${catId}/weight-records` },
          { label: "記録する" },
        ]}
      />

      <RecordPageHeading icon={TbWeight}>
        {cat.name}の体重を記録する
      </RecordPageHeading>
      <WeightRecordForm
        action={createWeightRecordAction.bind(null, catId)}
        submitLabel="記録する"
      />
    </main>
  );
}
