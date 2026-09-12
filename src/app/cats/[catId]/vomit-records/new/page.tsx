import { notFound } from "next/navigation";
import { TbToiletPaper } from "react-icons/tb";
import { Breadcrumb } from "@/components/ui";
import { getCatById } from "@/features/cats/queries";
import { resolveMediaLimits } from "@/features/media/limits";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import {
  createVomitRecordAction,
  updateVomitRecordAction,
} from "@/features/vomit-records/actions";
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
          { label: "トップ", href: "/home" },
          { label: "猫一覧", href: "/cats" },
          { label: cat.name, href: `/cats/${catId}` },
          { label: "嘔吐記録", href: `/cats/${catId}/vomit-records` },
          { label: "記録する" },
        ]}
      />

      <RecordPageHeading icon={TbToiletPaper}>
        {cat.name}の嘔吐を記録する
      </RecordPageHeading>
      <VomitRecordForm
        catId={catId}
        action={createVomitRecordAction.bind(null, catId)}
        updateAction={updateVomitRecordAction.bind(null, catId)}
        mediaLimits={resolveMediaLimits()}
        submitLabel="記録する"
      />
    </main>
  );
}
