import { notFound } from "next/navigation";
import { TbBath } from "react-icons/tb";
import { Breadcrumb } from "@/components/ui";
import { getCatById } from "@/features/cats/queries";
import { createShampooRecordAction } from "@/features/shampoo-records/actions";
import { ShampooRecordForm } from "@/features/shampoo-records/ShampooRecordForm";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import styles from "../page.module.css";

export const dynamic = "force-dynamic";

type NewShampooRecordPageProps = {
  params: Promise<{ catId: string }>;
};

export default async function NewShampooRecordPage({
  params,
}: NewShampooRecordPageProps) {
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
          { label: "シャンプー記録", href: `/cats/${catId}/shampoo-records` },
          { label: "記録する" },
        ]}
      />

      <RecordPageHeading icon={TbBath}>
        {cat.name}のシャンプーを記録する
      </RecordPageHeading>
      <ShampooRecordForm
        action={createShampooRecordAction.bind(null, catId)}
        submitLabel="記録する"
      />
    </main>
  );
}
