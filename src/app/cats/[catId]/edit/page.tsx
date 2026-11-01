import { notFound } from "next/navigation";
import { TbBell } from "react-icons/tb";
import { Breadcrumb, ButtonLink } from "@/components/ui";
import { getAccessibleCat, requireUser } from "@/features/auth/session";
import { updateCatAction } from "@/features/cats/actions";
import { CatForm } from "@/features/cats/CatForm";
import { CatIcon } from "@/features/cats/CatIcon";
import { listHouseholdsForUser } from "@/features/households/queries";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import styles from "../../page.module.css";

export const dynamic = "force-dynamic";

type EditCatPageProps = {
  params: Promise<{ catId: string }>;
};

export default async function EditCatPage({ params }: EditCatPageProps) {
  const { catId } = await params;
  const [user, cat] = await Promise.all([
    requireUser(),
    getAccessibleCat(catId),
  ]);

  if (!cat) {
    notFound();
  }

  // 引っ越し先として選べる、ユーザーが所属する家
  const households = await listHouseholdsForUser(user.id);

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/home" },
          { label: "猫一覧", href: "/cats" },
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
      <p>プロフィールや記念日、飼っている家を変更できます。</p>
      <CatForm
        action={updateCatAction.bind(null, cat.id)}
        cat={cat}
        households={households}
        submitLabel="更新する"
      />
    </main>
  );
}
