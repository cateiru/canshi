import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ui";
import { getCatById } from "@/features/cats/queries";
import { updateVomitRecordAction } from "@/features/vomit-records/actions";
import { getVomitRecordById } from "@/features/vomit-records/queries";
import { VomitRecordForm } from "@/features/vomit-records/VomitRecordForm";
import styles from "../../page.module.css";

export const dynamic = "force-dynamic";

type EditVomitRecordPageProps = {
  params: Promise<{ catId: string; vomitRecordId: string }>;
};

export default async function EditVomitRecordPage({
  params,
}: EditVomitRecordPageProps) {
  const { catId, vomitRecordId } = await params;
  const [cat, vomitRecord] = await Promise.all([
    getCatById(catId),
    getVomitRecordById(vomitRecordId),
  ]);

  if (!cat || !vomitRecord || vomitRecord.catId !== catId) {
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
          { label: "編集する" },
        ]}
      />

      <h1>{cat.name}の嘔吐記録を編集する</h1>
      <VomitRecordForm
        action={updateVomitRecordAction.bind(null, catId, vomitRecord.id)}
        vomitRecord={vomitRecord}
        submitLabel="更新する"
      />
    </main>
  );
}
