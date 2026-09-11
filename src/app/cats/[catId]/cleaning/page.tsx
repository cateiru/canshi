import { notFound } from "next/navigation";
import { Badge, Breadcrumb, Button, ButtonLink, Card } from "@/components/ui";
import { BroomIcon } from "@/components/ui/RecordIcons/RecordIcons";
import { getCatById } from "@/features/cats/queries";
import { quickCreateCleaningRecordAction } from "@/features/cleaning/recordActions";
import { listCleaningTargetsWithStatus } from "@/features/cleaning/targetQueries";
import { formatDateTimeUtc, getNaiveUtcNow } from "@/features/shared/datetime";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type CleaningPageProps = {
  params: Promise<{ catId: string }>;
};

export default async function CleaningPage({ params }: CleaningPageProps) {
  const { catId } = await params;
  const cat = await getCatById(catId);

  if (!cat) {
    notFound();
  }

  const statuses = await listCleaningTargetsWithStatus(catId, getNaiveUtcNow());
  const activeStatuses = statuses.filter((status) => status.target.isActive);
  const inactiveStatuses = statuses.filter((status) => !status.target.isActive);

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/home" },
          { label: "猫一覧", href: "/cats" },
          { label: cat.name, href: `/cats/${catId}` },
          { label: "掃除記録" },
        ]}
      />

      <div className={styles.header}>
        <RecordPageHeading icon={BroomIcon}>
          {cat.name}の掃除記録
        </RecordPageHeading>
        <div className={styles.headerActions}>
          <ButtonLink
            href={`/cats/${catId}/notification-settings`}
            variant="secondary"
          >
            通知設定
          </ButtonLink>
          <ButtonLink
            href={`/cats/${catId}/cleaning/targets/new`}
            variant="primary"
          >
            対象を追加する
          </ButtonLink>
        </div>
      </div>

      {statuses.length === 0 ? (
        <Card>
          <p>まだ掃除対象が登録されていません。</p>
          <div className={styles.emptyActions}>
            <ButtonLink
              href={`/cats/${catId}/cleaning/targets/new`}
              variant="primary"
            >
              最初の対象を追加する
            </ButtonLink>
          </div>
        </Card>
      ) : (
        <ul className={styles.list}>
          {activeStatuses.map((status) => (
            <li key={status.target.id}>
              <Card title={status.target.name}>
                <dl className={styles.details}>
                  <dt>前回の実施日</dt>
                  <dd>
                    {status.lastPerformedAt
                      ? formatDateTimeUtc(status.lastPerformedAt)
                      : "未実施"}
                  </dd>
                  <dt>次回の予定日</dt>
                  <dd>
                    {status.nextDueAt
                      ? formatDateTimeUtc(status.nextDueAt)
                      : "未定（未実施のため）"}
                  </dd>
                </dl>
                {status.isOverdue ? (
                  <div className={styles.badgeRow}>
                    <Badge color="warning">期限超過</Badge>
                  </div>
                ) : null}
                <div className={styles.cardActions}>
                  <form
                    action={quickCreateCleaningRecordAction.bind(
                      null,
                      catId,
                      status.target.id,
                    )}
                  >
                    <Button type="submit" variant="primary">
                      今すぐ掃除した
                    </Button>
                  </form>
                  <ButtonLink
                    href={`/cats/${catId}/cleaning/targets/${status.target.id}/records`}
                    variant="secondary"
                  >
                    記録を見る
                  </ButtonLink>
                  <ButtonLink
                    href={`/cats/${catId}/cleaning/targets/${status.target.id}/edit`}
                    variant="secondary"
                  >
                    編集する
                  </ButtonLink>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {inactiveStatuses.length > 0 ? (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>無効な対象</h2>
          <ul className={styles.list}>
            {inactiveStatuses.map((status) => (
              <li key={status.target.id} className={styles.inactive}>
                <Card title={status.target.name}>
                  <div className={styles.cardActions}>
                    <ButtonLink
                      href={`/cats/${catId}/cleaning/targets/${status.target.id}/records`}
                      variant="secondary"
                    >
                      記録を見る
                    </ButtonLink>
                    <ButtonLink
                      href={`/cats/${catId}/cleaning/targets/${status.target.id}/edit`}
                      variant="secondary"
                    >
                      編集する
                    </ButtonLink>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </main>
  );
}
