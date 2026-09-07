import { notFound } from "next/navigation";
import { getCatById } from "@/features/cats/queries";
import { createSymptomAction } from "@/features/symptoms/actions";
import { SymptomForm } from "@/features/symptoms/SymptomForm";
import styles from "../page.module.css";

export const dynamic = "force-dynamic";

type NewSymptomPageProps = {
  params: Promise<{ catId: string }>;
};

export default async function NewSymptomPage({ params }: NewSymptomPageProps) {
  const { catId } = await params;
  const cat = await getCatById(catId);

  if (!cat) {
    notFound();
  }

  return (
    <main className={styles.main}>
      <h1>{cat.name}の症状を記録する</h1>
      <SymptomForm
        action={createSymptomAction.bind(null, catId)}
        submitLabel="記録する"
      />
    </main>
  );
}
