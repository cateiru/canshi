import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ui";
import { getCatById } from "@/features/cats/queries";
import { createVomitRecordAction } from "@/features/vomit-records/actions";
import { VomitRecordForm } from "@/features/vomit-records/VomitRecordForm";
import styles from "../page.module.css";

export const dynamic = "force-dynamic";

type NewVomitRecordPageProps = {
  params: Promise<{ catId: string }>;
};

export default async function NewVomitRecordPage({
  params,
}: NewVomitRecordPageProps) {
  const { catId } = await params;
  const cat = await getCatById(catId);

  if (!cat) {
    notFound();
  }

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/" },
          { label: "猫一覧", href: "/cats" },
          { label: cat.name, href: `/cats/${catId}` },
          { label: "嘔吐記録", href: `/cats/${catId}/vomit-records` },
          { label: "記録する" },
        ]}
      />

      <h1>{cat.name}の嘔吐を記録する</h1>
      <VomitRecordForm
        action={createVomitRecordAction.bind(null, catId)}
        submitLabel="記録する"
      />
    </main>
  );
}
