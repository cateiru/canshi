import type { Metadata } from "next";
import { TbClock, TbPlus } from "react-icons/tb";
import {
  Breadcrumb,
  ButtonLink,
  Heading,
  RecordCard,
  RecordEmptyState,
} from "@/components/ui";
import { FeedingScheduleIcon } from "@/components/ui/RecordIcons/RecordIcons";
import { requireHouseholdAccess } from "@/features/auth/session";
import {
  createFeedingScheduleAction,
  deleteFeedingScheduleAction,
  updateFeedingScheduleNotifyAction,
} from "@/features/feeding-schedules/actions";
import { FeedingScheduleForm } from "@/features/feeding-schedules/FeedingScheduleForm";
import { listFeedingSchedules } from "@/features/feeding-schedules/mutations";
import { HouseholdMemberActionButton } from "@/features/households/HouseholdMemberActionButton";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import { Surface } from "@/features/shared/Surface";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "ごはんの時間 | CANSHI",
};

export const dynamic = "force-dynamic";

type FeedingSchedulesPageProps = {
  params: Promise<{ householdId: string }>;
};

export default async function FeedingSchedulesPage({
  params,
}: FeedingSchedulesPageProps) {
  const { householdId } = await params;
  const { household } = await requireHouseholdAccess(householdId);
  const schedules = await listFeedingSchedules(household.id);

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
          { label: "ごはんの時間" },
        ]}
      />

      <RecordPageHeading icon={FeedingScheduleIcon}>
        ごはんの時間
      </RecordPageHeading>

      <div className={styles.description}>
        <p>
          ごはんをあげる時間を登録すると、その時間にこの家のメンバーへお知らせします（日本時間）。
        </p>
        <p className={styles.note}>
          時間の前後にどの猫のごはんの記録もないときは、次のごはんの時間との中間で「ごはんはあげましたか？」と確認します。
          この家のどれかの猫のごはんを記録すると、未対応のお知らせは完了になります。
        </p>
      </div>

      <section
        aria-labelledby="feeding-schedules-heading"
        className={styles.section}
      >
        <Heading level={2} size="md" id="feeding-schedules-heading">
          登録したごはんの時間
        </Heading>
        {schedules.length > 0 ? (
          <ul className={styles.schedules}>
            {schedules.map((schedule) => (
              <li key={schedule.id}>
                <RecordCard
                  className={styles.schedule}
                  aria-label={`${schedule.time}のごはんの時間`}
                >
                  <div className={styles.scheduleHeader}>
                    <h3 className={styles.time}>
                      <TbClock size={20} aria-hidden="true" />
                      <time dateTime={schedule.time}>{schedule.time}</time>
                    </h3>
                    <HouseholdMemberActionButton
                      iconOnly
                      iconLabel={`${schedule.time}のごはんの時間を削除する`}
                      label="削除する"
                      title="ごはんの時間の削除"
                      description={`${schedule.time}のごはんの時間を削除しますか？この時間のお知らせは届かなくなります。`}
                      variant="danger"
                      successMessage={`${schedule.time}のごはんの時間を削除しました`}
                      action={deleteFeedingScheduleAction.bind(
                        null,
                        household.id,
                        schedule.id,
                      )}
                    />
                  </div>
                  <FeedingScheduleForm
                    action={updateFeedingScheduleNotifyAction.bind(
                      null,
                      household.id,
                      schedule.id,
                    )}
                    schedule={schedule}
                  />
                </RecordCard>
              </li>
            ))}
          </ul>
        ) : (
          <RecordEmptyState
            icon={FeedingScheduleIcon}
            actions={
              <ButtonLink
                href="#feeding-schedule-new-heading"
                variant="primary"
                leftIcon={TbPlus}
              >
                ごはんの時間を追加する
              </ButtonLink>
            }
          >
            まだごはんの時間が登録されていません。
          </RecordEmptyState>
        )}
      </section>

      <Surface
        title="ごはんの時間を追加"
        titleId="feeding-schedule-new-heading"
        gap="md"
        icon={<TbPlus size={20} aria-hidden="true" />}
      >
        <FeedingScheduleForm
          action={createFeedingScheduleAction.bind(null, household.id)}
        />
      </Surface>
    </main>
  );
}
