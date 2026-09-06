import Link from "next/link";
import { Badge, ButtonLink, Card } from "@/components/ui";
import {
  calculateAge,
  calculateDaysSinceAdoption,
  formatAge,
} from "@/features/cats/age";
import { SEX_LABEL } from "@/features/cats/labels";
import { listCats } from "@/features/cats/queries";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function CatsPage() {
  const catList = await listCats();

  return (
    <main className={styles.main}>
      <div className={styles.header}>
        <h1>猫一覧</h1>
        <ButtonLink href="/cats/new" variant="primary">
          猫を登録する
        </ButtonLink>
      </div>

      {catList.length === 0 ? (
        <Card>
          <p>まだ猫が登録されていません。</p>
          <div className={styles.emptyActions}>
            <ButtonLink href="/cats/new" variant="primary">
              最初の猫を登録する
            </ButtonLink>
          </div>
        </Card>
      ) : (
        <ul className={styles.list}>
          {catList.map((cat) => (
            <li key={cat.id}>
              <Link href={`/cats/${cat.id}`} className={styles.cardLink}>
                <Card title={cat.name}>
                  <Badge>{SEX_LABEL[cat.sex]}</Badge>
                  {cat.birthDate ? (
                    <p>{formatAge(calculateAge(cat.birthDate))}</p>
                  ) : null}
                  {cat.adoptedAt ? (
                    <p>
                      お迎えから{calculateDaysSinceAdoption(cat.adoptedAt)}日
                    </p>
                  ) : null}
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
