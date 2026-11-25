import { MemoLabelIcon } from "@canshi/shared/ui/RecordIcons";
import type { Metadata } from "next";
import { Breadcrumb, RecordEmptyState } from "@/components/ui";
import { requireHouseholdAccess } from "@/features/auth/presentation/session";
import { listMemoLabelsWithCount } from "@/features/memo-records/infrastructure/labelQueries";
import {
  createMemoLabelAction,
  deleteMemoLabelAction,
  updateMemoLabelAction,
} from "@/features/memo-records/presentation/labelActions";
import {
  AddMemoLabelButton,
  DeleteMemoLabelButton,
  EditMemoLabelButton,
} from "@/features/memo-records/presentation/MemoLabelButtons";
import { MemoLabelChip } from "@/features/memo-records/presentation/MemoLabelChip";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import { Surface } from "@/features/shared/Surface";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "メモのラベル",
};

export const dynamic = "force-dynamic";

type MemoLabelsPageProps = {
  params: Promise<{ householdId: string }>;
};

export default async function MemoLabelsPage({ params }: MemoLabelsPageProps) {
  const { householdId } = await params;
  const { household } = await requireHouseholdAccess(householdId);
  const labels = await listMemoLabelsWithCount([household.id]);

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/home" },
          { label: "設定", href: "/settings" },
          { label: "家の設定", href: "/settings/households" },
          {
            label: household.name,
            href: `/settings/households/${household.id}`,
          },
          { label: "メモのラベル" },
        ]}
      />

      <div className={styles.header}>
        <RecordPageHeading icon={MemoLabelIcon}>メモのラベル</RecordPageHeading>
        <AddMemoLabelButton
          action={createMemoLabelAction.bind(null, household.id)}
        />
      </div>

      <p className={styles.note}>
        ラベルは、この家のすべてのねこのメモで使えます。メモに付いているラベルは削除できません。
      </p>

      {labels.length === 0 ? (
        <RecordEmptyState icon={MemoLabelIcon}>
          まだラベルがありません。
        </RecordEmptyState>
      ) : (
        <Surface>
          <ul className={styles.labels} aria-label="メモのラベル">
            {labels.map(({ id, name, color, memoCount }) => {
              const label = { id, name, color };
              return (
                <li key={id} className={styles.label}>
                  <div className={styles.labelInfo}>
                    <MemoLabelChip label={label} />
                    <span className={styles.count}>{memoCount}件のメモ</span>
                  </div>
                  <div className={styles.labelActions}>
                    <EditMemoLabelButton
                      label={label}
                      action={updateMemoLabelAction.bind(null, id)}
                    />
                    <DeleteMemoLabelButton
                      label={label}
                      memoCount={memoCount}
                      action={deleteMemoLabelAction.bind(null, id)}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </Surface>
      )}
    </main>
  );
}
