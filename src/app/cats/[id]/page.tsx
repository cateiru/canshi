import { notFound } from "next/navigation";
import { Badge, ButtonLink, Card } from "@/components/ui";
import { deleteCatAction } from "@/features/cats/actions";
import {
  calculateAge,
  calculateDaysSinceAdoption,
  formatAge,
} from "@/features/cats/age";
import { DeleteCatButton } from "@/features/cats/DeleteCatButton";
import { SEX_LABEL } from "@/features/cats/labels";
import { getCatById } from "@/features/cats/queries";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type CatDetailPageProps = {
  params: { id: string };
};

export default async function CatDetailPage({ params }: CatDetailPageProps) {
  const { id } = params;
  const cat = await getCatById(id);

  if (!cat) {
    notFound();
  }

  return (
    <main className={styles.main}>
      <h1>{cat.name}</h1>

      <Card>
        <Badge>{SEX_LABEL[cat.sex]}</Badge>
        <dl className={styles.details}>
          <dt>生年月日</dt>
          <dd>
            {cat.birthDate ?? "未設定"}
            {cat.birthDate
              ? `（${formatAge(calculateAge(cat.birthDate))}）`
              : ""}
          </dd>
          <dt>猫種</dt>
          <dd>{cat.breed ?? "未設定"}</dd>
          <dt>お迎え日</dt>
          <dd>
            {cat.adoptedAt ?? "未設定"}
            {cat.adoptedAt
              ? `（お迎えから${calculateDaysSinceAdoption(cat.adoptedAt)}日）`
              : ""}
          </dd>
        </dl>
      </Card>

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
