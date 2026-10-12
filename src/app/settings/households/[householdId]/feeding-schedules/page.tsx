import type { Metadata } from "next";
import { Breadcrumb } from "@/components/ui";
import { FeedingIcon } from "@/components/ui/RecordIcons/RecordIcons";
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

      <RecordPageHeading icon={FeedingIcon}>ごはんの時間</RecordPageHeading>

      <p className={styles.note}>
        ごはんをあげる時間を登録すると、この家の猫ごとにお知らせします（日本時間）。
        時間の前後にごはんの記録がないときは、次のごはんの時間との中間で「ごはんはあげましたか？」と確認します。
        ごはんを記録すると、その猫の未対応のお知らせは完了になります。
      </p>

      <Surface
        title="登録したごはんの時間"
        titleId="feeding-schedules-heading"
        gap="md"
      >
        {schedules.length > 0 ? (
          <ul className={styles.schedules}>
            {schedules.map((schedule) => (
              <li key={schedule.id} className={styles.schedule}>
                <div className={styles.scheduleHeader}>
                  <span className={styles.time}>{schedule.time}</span>
                  <HouseholdMemberActionButton
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
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.note}>まだごはんの時間が登録されていません。</p>
        )}
      </Surface>

      <Surface
        title="ごはんの時間を追加"
        titleId="feeding-schedule-new-heading"
        gap="md"
      >
        <FeedingScheduleForm
          action={createFeedingScheduleAction.bind(null, household.id)}
        />
      </Surface>
    </main>
  );
}
