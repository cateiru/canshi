import { notFound } from "next/navigation";
import { getCatById } from "@/features/cats/queries";
import { createPoopRecordAction } from "@/features/poop-records/actions";
import { PoopRecordForm } from "@/features/poop-records/PoopRecordForm";
import styles from "../page.module.css";

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
      <h1>{cat.name}のうんちを記録する</h1>
      <PoopRecordForm
        action={createPoopRecordAction.bind(null, catId)}
        submitLabel="記録する"
      />
    </main>
  );
}
