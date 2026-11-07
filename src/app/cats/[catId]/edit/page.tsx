import { notFound } from "next/navigation";
import { TbBell } from "react-icons/tb";
import { Breadcrumb, ButtonLink } from "@/components/ui";
import { getAccessibleCat } from "@/features/auth/presentation/session";
import { updateCatAction } from "@/features/cats/presentation/actions";
import { CatForm } from "@/features/cats/presentation/CatForm";
import { CatIcon } from "@/features/cats/presentation/CatIcon";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import styles from "../../page.module.css";

export const dynamic = "force-dynamic";

type EditCatPageProps = {
  params: Promise<{ catId: string }>;
};

export default async function EditCatPage({ params }: EditCatPageProps) {
  const { catId } = await params;
  const cat = await getAccessibleCat(catId);

  if (!cat) {
    notFound();
  }

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/home" },
          { label: "ねこ一覧", href: "/cats" },
          { label: cat.name, href: `/cats/${cat.id}` },
          { label: "編集する" },
        ]}
      />

      <div className={styles.header}>
        <RecordPageHeading icon={CatIcon}>
          {cat.name}を編集する
        </RecordPageHeading>
        <ButtonLink
          href={`/cats/${cat.id}/notification-settings`}
          variant="secondary"
          leftIcon={TbBell}
        >
          通知設定
        </ButtonLink>
      </div>
      <p>プロフィールや記念日を変更できます。</p>
      <CatForm
        action={updateCatAction.bind(null, cat.id)}
        cat={cat}
        submitLabel="更新する"
      />
    </main>
  );
}
