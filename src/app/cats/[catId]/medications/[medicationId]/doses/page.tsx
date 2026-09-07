import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, ButtonLink, Card } from "@/components/ui";
import { getCatById } from "@/features/cats/queries";
import { deleteMedicationDoseAction } from "@/features/medications/doseActions";
import { listMedicationDoses } from "@/features/medications/doseQueries";
import { getMedicationById } from "@/features/medications/queries";
import { DeleteRecordButton } from "@/features/shared/DeleteRecordButton";
import { formatDateTimeUtc } from "@/features/shared/datetime";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type MedicationDosesPageProps = {
  params: Promise<{ catId: string; medicationId: string }>;
};

export default async function MedicationDosesPage({
  params,
}: MedicationDosesPageProps) {
  const { catId, medicationId } = await params;
  const [cat, medication] = await Promise.all([
    getCatById(catId),
    getMedicationById(medicationId),
  ]);

  if (!cat || !medication || medication.catId !== catId) {
    notFound();
  }

  const doses = await listMedicationDoses(medicationId);

  return (
    <main className={styles.main}>
      <Link href={`/cats/${catId}/medications`} className={styles.backLink}>
        ← {cat.name}の服薬予定一覧に戻る
      </Link>

      <div className={styles.header}>
        <h1>{medication.name}の投薬実績</h1>
        <ButtonLink
          href={`/cats/${catId}/medications/${medicationId}/doses/new`}
          variant="primary"
        >
          記録する
        </ButtonLink>
      </div>

      {doses.length === 0 ? (
        <Card>
          <p>まだ投薬実績がありません。</p>
          <div className={styles.emptyActions}>
            <ButtonLink
              href={`/cats/${catId}/medications/${medicationId}/doses/new`}
              variant="primary"
            >
              最初の実績を記録する
            </ButtonLink>
          </div>
        </Card>
      ) : (
        <ul className={styles.list}>
          {doses.map((dose) => (
            <li key={dose.id}>
              <Card title={formatDateTimeUtc(dose.occurredAt)}>
                <Badge color={dose.wasAdministered ? "success" : "warning"}>
                  {dose.wasAdministered ? "投薬できた" : "投薬できなかった"}
                </Badge>
                {dose.memo ? <p>{dose.memo}</p> : null}
                <div className={styles.cardActions}>
                  <ButtonLink
                    href={`/cats/${catId}/medications/${medicationId}/doses/${dose.id}/edit`}
                    variant="secondary"
                  >
                    編集する
                  </ButtonLink>
                  <DeleteRecordButton
                    action={deleteMedicationDoseAction.bind(
                      null,
                      catId,
                      medicationId,
                      dose.id,
                    )}
                    title="投薬実績の削除"
                    description="この投薬実績を削除しますか？この操作は取り消せません。"
                  />
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
