import { notFound } from "next/navigation";
import { TbBell } from "react-icons/tb";
import { Breadcrumb, ButtonLink } from "@/components/ui";
import { getAccessibleCat } from "@/features/auth/presentation/session";
import { formatMemorialDate } from "@/features/cats/domain/memorial";
import {
  memorializeCatAction,
  restoreCatFromMemorialAction,
  updateCatAction,
} from "@/features/cats/presentation/actions";
import { CatForm } from "@/features/cats/presentation/CatForm";
import { CatIcon } from "@/features/cats/presentation/CatIcon";
import { catPageMetadata } from "@/features/cats/presentation/catPageMetadata";
import {
  MemorializeCatButton,
  RestoreCatFromMemorialButton,
} from "@/features/cats/presentation/MemorialActions";
import { MemorialNotice } from "@/features/cats/presentation/MemorialNotice";
import { getNaiveUtcNow, splitDateTimeUtc } from "@/features/shared/datetime";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import { Surface } from "@/features/shared/Surface";
import styles from "../../page.module.css";

export const dynamic = "force-dynamic";

export const generateMetadata = catPageMetadata(
  (catName) => `${catName}を編集する`,
);

type EditCatPageProps = {
  params: Promise<{ catId: string }>;
};

export default async function EditCatPage({ params }: EditCatPageProps) {
  const { catId } = await params;
  const cat = await getAccessibleCat(catId);

  if (!cat) {
    notFound();
  }

  const breadcrumb = (
    <Breadcrumb
      items={[
        { label: "トップ", href: "/home" },
        { label: "ねこ一覧", href: "/cats" },
        { label: cat.name, href: `/cats/${cat.id}` },
        { label: "編集する" },
      ]}
    />
  );

  // メモリーへ移した猫は、プロフィールを変えられない。メモリーから戻す操作だけを置く
  if (cat.memorialDate) {
    return (
      <main className={styles.main}>
        {breadcrumb}
        <RecordPageHeading icon={CatIcon}>
          {cat.name}を編集する
        </RecordPageHeading>
        <MemorialNotice>
          <p>
            {formatMemorialDate(cat.memorialDate)}
            にメモリーに移しました。メモリーに移したねこのプロフィールや通知の設定は変更できません。
          </p>
          <p>変更したいときは、メモリーから戻してください。</p>
        </MemorialNotice>
        <div>
          <RestoreCatFromMemorialButton
            action={restoreCatFromMemorialAction.bind(null, cat.id)}
            catName={cat.name}
          />
        </div>
      </main>
    );
  }

  return (
    <main className={styles.main}>
      {breadcrumb}

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

      <Surface title="メモリー" gap="md">
        <p>
          旅立ったねこを、これまでの記録とともに思い出として残せます。メモリーへ移すと、記録の追加やお知らせが止まります。
        </p>
        <div>
          <MemorializeCatButton
            action={memorializeCatAction.bind(null, cat.id)}
            catName={cat.name}
            today={splitDateTimeUtc(getNaiveUtcNow()).date}
          />
        </div>
      </Surface>
    </main>
  );
}
