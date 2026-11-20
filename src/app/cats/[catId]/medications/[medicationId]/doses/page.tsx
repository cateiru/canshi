import { MedicationIcon } from "@canshi/shared/ui/RecordIcons";
import { ScaledIcon } from "@canshi/shared/ui/ScaledIcon";
import { notFound } from "next/navigation";
import { TbClock, TbPencil, TbPlus } from "react-icons/tb";
import {
  Badge,
  Breadcrumb,
  ButtonLink,
  IconButtonLink,
  Pagination,
  RecordCard,
  RecordEmptyState,
} from "@/components/ui";
import { getAccessibleCat } from "@/features/auth/presentation/session";
import { isMemorialCat } from "@/features/cats/domain/memorial";
import { listMedicationDoses } from "@/features/medications/infrastructure/doseQueries";
import { getMedicationById } from "@/features/medications/infrastructure/queries";
import { deleteMedicationDoseAction } from "@/features/medications/presentation/doseActions";
import { medicationPageMetadata } from "@/features/medications/presentation/medicationPageMetadata";
import { loadRecordContributors } from "@/features/record-contributors/presentation/load";
import { RecordContributors } from "@/features/record-contributors/presentation/RecordContributors";
import { DeleteRecordButton } from "@/features/shared/DeleteRecordButton";
import { formatDateTimeUtc } from "@/features/shared/datetime";
import {
  buildPageHref,
  paginate,
  parsePageParam,
} from "@/features/shared/pagination";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export const generateMetadata = medicationPageMetadata(
  (medicationName) => `${medicationName}の投薬実績`,
);

type MedicationDosesPageProps = {
  params: Promise<{ catId: string; medicationId: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
};

export default async function MedicationDosesPage({
  params,
  searchParams,
}: MedicationDosesPageProps) {
  const { catId, medicationId } = await params;
  const [cat, medication] = await Promise.all([
    getAccessibleCat(catId),
    getMedicationById(medicationId),
  ]);

  if (!cat || !medication || medication.catId !== catId) {
    notFound();
  }
  // メモリーへ移した猫は、記録を見返すだけにする（追加・編集・削除の導線を出さない）
  const readOnly = isMemorialCat(cat);

  const doses = await listMedicationDoses(medicationId);
  const { page: pageParam } = await searchParams;
  const {
    items: pagedDoses,
    page,
    totalPages,
  } = paginate(doses, parsePageParam(pageParam));
  const contributorsByRecordId = await loadRecordContributors(
    "medication_dose",
    pagedDoses.map((dose) => dose.id),
  );

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/home" },
          { label: "ねこ一覧", href: "/cats" },
          { label: cat.name, href: `/cats/${catId}` },
          { label: "服薬予定", href: `/cats/${catId}/medications` },
          { label: "投薬実績" },
        ]}
      />

      <div className={styles.header}>
        <RecordPageHeading icon={MedicationIcon}>
          {medication.name}の投薬実績
        </RecordPageHeading>
        {readOnly ? null : (
          <ButtonLink
            href={`/cats/${catId}/medications/${medicationId}/doses/new`}
            variant="primary"
            className={styles.createButton}
            leftIcon={TbPlus}
          >
            記録する
          </ButtonLink>
        )}
      </div>

      {doses.length === 0 ? (
        <RecordEmptyState
          icon={MedicationIcon}
          actions={
            readOnly ? undefined : (
              <ButtonLink
                href={`/cats/${catId}/medications/${medicationId}/doses/new`}
                variant="primary"
                className={styles.createButton}
              >
                最初の実績を記録する
              </ButtonLink>
            )
          }
        >
          まだ投薬実績がありません。
        </RecordEmptyState>
      ) : (
        <ul className={styles.list}>
          {pagedDoses.map((dose) => (
            <li key={dose.id}>
              <RecordCard aria-label={formatDateTimeUtc(dose.occurredAt)}>
                <div className={styles.recordHeader}>
                  <h2 className={styles.recordDate}>
                    <ScaledIcon icon={TbClock} aria-hidden="true" size={18} />
                    <time dateTime={dose.occurredAt.toISOString()}>
                      {formatDateTimeUtc(dose.occurredAt)}
                    </time>
                  </h2>
                  <div className={styles.cardActions}>
                    <RecordContributors
                      contributors={contributorsByRecordId.get(dose.id)}
                    />
                    {readOnly ? null : (
                      <>
                        <IconButtonLink
                          href={`/cats/${catId}/medications/${medicationId}/doses/${dose.id}/edit`}
                          icon={TbPencil}
                          aria-label="編集する"
                          title="編集する"
                        />
                        <DeleteRecordButton
                          action={deleteMedicationDoseAction.bind(
                            null,
                            catId,
                            medicationId,
                            dose.id,
                          )}
                          title="投薬実績の削除"
                          description="この投薬実績を削除しますか？この操作は取り消せません。"
                          iconOnly
                        />
                      </>
                    )}
                  </div>
                </div>

                <div className={styles.badges}>
                  <Badge color={dose.wasAdministered ? "success" : "warning"}>
                    {dose.wasAdministered ? "投薬できた" : "投薬できなかった"}
                  </Badge>
                </div>

                {dose.memo ? <p className={styles.memo}>{dose.memo}</p> : null}
              </RecordCard>
            </li>
          ))}
        </ul>
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        getHref={(target) =>
          buildPageHref(
            `/cats/${catId}/medications/${medicationId}/doses`,
            target,
          )
        }
      />
    </main>
  );
}
