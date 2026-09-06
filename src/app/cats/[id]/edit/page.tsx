import { notFound } from "next/navigation";
import { updateCatAction } from "@/features/cats/actions";
import { CatForm } from "@/features/cats/CatForm";
import { getCatById } from "@/features/cats/queries";
import styles from "../../page.module.css";

export const dynamic = "force-dynamic";

type EditCatPageProps = {
  params: { id: string };
};

export default async function EditCatPage({ params }: EditCatPageProps) {
  const { id } = params;
  const cat = await getCatById(id);

  if (!cat) {
    notFound();
  }

  return (
    <main className={styles.main}>
      <h1>{cat.name}を編集する</h1>
      <CatForm
        action={updateCatAction.bind(null, cat.id)}
        cat={cat}
        submitLabel="更新する"
      />
    </main>
  );
}
