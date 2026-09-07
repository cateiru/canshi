import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ui";
import { updateCatAction } from "@/features/cats/actions";
import { CatForm } from "@/features/cats/CatForm";
import { getCatById } from "@/features/cats/queries";
import styles from "../../page.module.css";

export const dynamic = "force-dynamic";

type EditCatPageProps = {
  params: Promise<{ catId: string }>;
};

export default async function EditCatPage({ params }: EditCatPageProps) {
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
          { label: cat.name, href: `/cats/${cat.id}` },
          { label: "編集する" },
        ]}
      />

      <h1>{cat.name}を編集する</h1>
      <CatForm
        action={updateCatAction.bind(null, cat.id)}
        cat={cat}
        submitLabel="更新する"
      />
    </main>
  );
}
