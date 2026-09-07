import Link from "next/link";
import { notFound } from "next/navigation";
import { TbTemperature } from "react-icons/tb";
import { Badge, ButtonLink, Card } from "@/components/ui";
import { getCatById } from "@/features/cats/queries";
import { hospitalVisitOptionLabel } from "@/features/hospital-visits/labels";
import { listHospitalVisits } from "@/features/hospital-visits/queries";
import { DeleteRecordButton } from "@/features/shared/DeleteRecordButton";
import { formatDateTimeUtc } from "@/features/shared/datetime";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import { deleteSymptomAction } from "@/features/symptoms/actions";
import { STATUS_LABEL } from "@/features/symptoms/labels";
import { listSymptoms } from "@/features/symptoms/queries";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

const STATUS_BADGE_COLOR = {
  ongoing: "warning",
  improving: "info",
  resolved: "success",
} as const;

type SymptomsPageProps = {
  params: Promise<{ catId: string }>;
};

export default async function SymptomsPage({ params }: SymptomsPageProps) {
  const { catId } = await params;
  const cat = await getCatById(catId);

  if (!cat) {
    notFound();
  }

  const [records, hospitalVisitList] = await Promise.all([
    listSymptoms(catId),
    listHospitalVisits(catId),
  ]);
  const hospitalVisitLabelById = new Map(
    hospitalVisitList.map((visit) => [
      visit.id,
      hospitalVisitOptionLabel(visit),
    ]),
  );

  return (
    <main className={styles.main}>
      <Link href={`/cats/${catId}`} className={styles.backLink}>
        ← {cat.name}のページに戻る
      </Link>

      <div className={styles.header}>
        <RecordPageHeading icon={TbTemperature}>
          {cat.name}の症状記録
        </RecordPageHeading>
        <ButtonLink href={`/cats/${catId}/symptoms/new`} variant="primary">
          記録する
        </ButtonLink>
      </div>

      {records.length === 0 ? (
        <Card>
          <p>まだ症状記録がありません。</p>
          <div className={styles.emptyActions}>
            <ButtonLink href={`/cats/${catId}/symptoms/new`} variant="primary">
              最初の記録をする
            </ButtonLink>
          </div>
        </Card>
      ) : (
        <ul className={styles.list}>
          {records.map((record) => (
            <li key={record.id}>
              <Card title={record.symptomType}>
                <Badge color={STATUS_BADGE_COLOR[record.status]}>
                  {STATUS_LABEL[record.status]}
                </Badge>
                <dl className={styles.details}>
                  <dt>発症日時</dt>
                  <dd>{formatDateTimeUtc(record.onsetAt)}</dd>
                  {record.frequencyOrSeverity ? (
                    <>
                      <dt>回数・程度</dt>
                      <dd>{record.frequencyOrSeverity}</dd>
                    </>
                  ) : null}
                  {record.appetiteNote ? (
                    <>
                      <dt>食欲</dt>
                      <dd>{record.appetiteNote}</dd>
                    </>
                  ) : null}
                  {record.energyNote ? (
                    <>
                      <dt>元気</dt>
                      <dd>{record.energyNote}</dd>
                    </>
                  ) : null}
                  {record.hospitalVisitId ? (
                    <>
                      <dt>関連する通院記録</dt>
                      <dd>
                        {hospitalVisitLabelById.get(record.hospitalVisitId) ??
                          "不明な通院記録"}
                      </dd>
                    </>
                  ) : null}
                  {record.memo ? (
                    <>
                      <dt>備考</dt>
                      <dd>{record.memo}</dd>
                    </>
                  ) : null}
                </dl>
                <div className={styles.cardActions}>
                  <ButtonLink
                    href={`/cats/${catId}/symptoms/${record.id}/edit`}
                    variant="secondary"
                  >
                    編集する
                  </ButtonLink>
                  <DeleteRecordButton
                    action={deleteSymptomAction.bind(null, catId, record.id)}
                    title="症状記録の削除"
                    description="この症状記録を削除しますか？この操作は取り消せません。"
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
