import { notFound } from "next/navigation";
import {
  Badge,
  Breadcrumb,
  ButtonLink,
  Collapsible,
  Heading,
} from "@/components/ui";
import { getAccessibleCat } from "@/features/auth/session";
import { deleteCatAction } from "@/features/cats/actions";
import {
  calculateAge,
  calculateTimeSinceAdoption,
  formatAge,
  formatTimeSinceAdoption,
} from "@/features/cats/age";
import { BirthdayCelebration } from "@/features/cats/BirthdayCelebration";
import { formatBirthDate } from "@/features/cats/birthDate";
import { toBirthdayCelebrationCat } from "@/features/cats/birthday";
import { CatAvatar } from "@/features/cats/CatAvatar";
import { DeleteCatButton } from "@/features/cats/DeleteCatButton";
import { SEX_LABEL } from "@/features/cats/labels";
import { RecordNavGrid } from "@/features/cats/RecordNavGrid";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type CatDetailPageProps = {
  params: Promise<{ catId: string }>;
};

export default async function CatDetailPage({ params }: CatDetailPageProps) {
  const { catId } = await params;
  const cat = await getAccessibleCat(catId);

  if (!cat) {
    notFound();
  }

  const timeSinceAdoption = cat.adoptedAt
    ? calculateTimeSinceAdoption(cat.adoptedAt)
    : null;

  return (
    <main className={styles.main}>
      <BirthdayCelebration cats={[toBirthdayCelebrationCat(cat)]} />
      <Breadcrumb
        items={[
          { label: "トップ", href: "/home" },
          { label: "猫一覧", href: "/cats" },
          { label: cat.name },
        ]}
      />

      <div className={styles.profile}>
        <CatAvatar
          name={cat.name}
          profileMediaAssetId={cat.profileMediaAssetId}
          size="lg"
        />
        <h1>{cat.name}</h1>
      </div>

      <Collapsible title="基本情報" storageKey="canshi:cat-basic-info-expanded">
        <Badge>{SEX_LABEL[cat.sex]}</Badge>
        <dl className={styles.details}>
          <dt>生年月日</dt>
          <dd>
            {cat.birthDate
              ? formatBirthDate(cat.birthDate, cat.birthDatePrecision)
              : "未設定"}
            {cat.birthDate
              ? `（${formatAge(calculateAge(cat.birthDate))}）`
              : ""}
          </dd>
          <dt>猫種</dt>
          <dd>{cat.breed ?? "未設定"}</dd>
          <dt>お迎え日</dt>
          <dd>
            {cat.adoptedAt ?? "未設定"}
            {timeSinceAdoption
              ? `（お迎えから${formatTimeSinceAdoption(timeSinceAdoption)}）`
              : ""}
          </dd>
        </dl>
      </Collapsible>

      <section>
        <Heading level={2} size="md" className={styles.recordHeading}>
          記録
        </Heading>
        <RecordNavGrid catId={cat.id} />
      </section>

      <div className={styles.actions}>
        <ButtonLink href={`/cats/${cat.id}/edit`} variant="secondary">
          編集する
        </ButtonLink>
        <DeleteCatButton
          action={deleteCatAction.bind(null, cat.id)}
          catName={cat.name}
        />
      </div>
    </main>
  );
}
