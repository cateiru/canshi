import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ui";
import { PoopIcon } from "@/components/ui/RecordIcons/RecordIcons";
import { getCatById } from "@/features/cats/queries";
import { resolveMediaLimits } from "@/features/media/limits";
import {
  createPoopRecordAction,
  updatePoopRecordAction,
} from "@/features/poop-records/actions";
import { PoopRecordForm } from "@/features/poop-records/PoopRecordForm";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import styles from "../page.module.css";

export const dynamic = "force-dynamic";

type NewPoopRecordPageProps = {
  params: Promise<{ catId: string }>;
};

export default async function NewPoopRecordPage({
  params,
}: NewPoopRecordPageProps) {
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
          { label: "うんち記録", href: `/cats/${catId}/poop-records` },
          { label: "記録する" },
        ]}
      />

      <RecordPageHeading icon={PoopIcon}>
        {cat.name}のうんちを記録する
      </RecordPageHeading>
      <PoopRecordForm
        catId={catId}
        action={createPoopRecordAction.bind(null, catId)}
        updateAction={updatePoopRecordAction.bind(null, catId)}
        mediaLimits={resolveMediaLimits()}
        submitLabel="記録する"
      />
    </main>
  );
}
