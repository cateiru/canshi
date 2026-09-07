import { notFound } from "next/navigation";
import { getCatById } from "@/features/cats/queries";
import { updatePoopRecordAction } from "@/features/poop-records/actions";
import { PoopRecordForm } from "@/features/poop-records/PoopRecordForm";
import { getPoopRecordById } from "@/features/poop-records/queries";
import styles from "../../page.module.css";

export const dynamic = "force-dynamic";

type EditPoopRecordPageProps = {
  params: Promise<{ catId: string; poopRecordId: string }>;
};

export default async function EditPoopRecordPage({
  params,
}: EditPoopRecordPageProps) {
  const { catId, poopRecordId } = await params;
  const [cat, poopRecord] = await Promise.all([
    getCatById(catId),
    getPoopRecordById(poopRecordId),
  ]);

  if (!cat || !poopRecord || poopRecord.catId !== catId) {
    notFound();
  }

  return (
    <main className={styles.main}>
      <h1>{cat.name}のうんち記録を編集する</h1>
      <PoopRecordForm
        action={updatePoopRecordAction.bind(null, catId, poopRecord.id)}
        poopRecord={poopRecord}
        submitLabel="更新する"
      />
    </main>
  );
}
