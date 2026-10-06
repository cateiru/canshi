import type { Metadata } from "next";
import { Badge, Breadcrumb } from "@/components/ui";
import { HouseholdIcon } from "@/components/ui/RecordIcons/RecordIcons";
import { requireHouseholdAccess } from "@/features/auth/session";
import {
  leaveHouseholdAction,
  removeHouseholdMemberAction,
  transferHouseholdOwnershipAction,
  updateHouseholdNameAction,
} from "@/features/households/actions";
import { HouseholdMemberActionButton } from "@/features/households/HouseholdMemberActionButton";
import { HouseholdNameForm } from "@/features/households/HouseholdNameForm";
import { HOUSEHOLD_ROLE_LABEL } from "@/features/households/labels";
import { listHouseholdMembers } from "@/features/households/queries";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import { Surface } from "@/features/shared/Surface";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "家の設定 | CANSHI",
};

export const dynamic = "force-dynamic";

type HouseholdSettingsPageProps = {
  params: Promise<{ householdId: string }>;
};

export default async function HouseholdSettingsPage({
  params,
}: HouseholdSettingsPageProps) {
  const { householdId } = await params;
  const { user, household } = await requireHouseholdAccess(householdId);
  const members = await listHouseholdMembers(household.id);
  const isOwner = household.role === "owner";

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/home" },
          { label: "設定", href: "/settings" },
          { label: "家の設定", href: "/settings/households" },
          { label: household.name },
        ]}
      />

      <RecordPageHeading icon={HouseholdIcon}>
        {household.name}
      </RecordPageHeading>

      <Surface title="基本情報" titleId="household-basic-heading" gap="md">
        {isOwner ? (
          <HouseholdNameForm
            action={updateHouseholdNameAction.bind(null, household.id)}
            defaultName={household.name}
          />
        ) : (
          <p className={styles.note}>
            家の名前を変えられるのはオーナーだけです。
          </p>
        )}
      </Surface>

      <Surface title="メンバー" titleId="household-members-heading" gap="md">
        <ul className={styles.members}>
          {members.map((member) => {
            const isSelf = member.userId === user.id;
            return (
              <li key={member.userId} className={styles.member}>
                <div className={styles.memberInfo}>
                  <span className={styles.memberName}>
                    {member.name}
                    {isSelf ? "（あなた）" : null}
                  </span>
                  <Badge color={member.role === "owner" ? "accent" : "info"}>
                    {HOUSEHOLD_ROLE_LABEL[member.role]}
                  </Badge>
                </div>
                <div className={styles.memberActions}>
                  {isOwner && member.role === "member" ? (
                    <>
                      <HouseholdMemberActionButton
                        label="オーナーにする"
                        title="オーナーの移譲"
                        description={`「${member.name}」を家のオーナーにしますか？あなたはオーナーではなくなり、家の名前やメンバーを管理できなくなります。`}
                        successMessage={`「${member.name}」を家のオーナーにしました`}
                        action={transferHouseholdOwnershipAction.bind(
                          null,
                          household.id,
                          member.userId,
                        )}
                      />
                      <HouseholdMemberActionButton
                        label="家から外す"
                        title="メンバーを外す"
                        description={`「${member.name}」を家から外しますか？外したメンバーは、この家の猫を見られなくなり、通知も届かなくなります。`}
                        variant="danger"
                        successMessage={`「${member.name}」を家から外しました`}
                        action={removeHouseholdMemberAction.bind(
                          null,
                          household.id,
                          member.userId,
                        )}
                      />
                    </>
                  ) : null}
                  {isSelf && member.role === "member" ? (
                    <HouseholdMemberActionButton
                      label="家から抜ける"
                      title="家から抜ける"
                      description={`「${household.name}」から抜けますか？この家の猫を見られなくなり、通知も届かなくなります。`}
                      variant="danger"
                      successMessage={`「${household.name}」から抜けました`}
                      action={leaveHouseholdAction.bind(null, household.id)}
                    />
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
        {isOwner ? (
          <p className={styles.note}>
            オーナーは家から抜けられません。抜けるときは、先にほかのメンバーをオーナーにしてください。
          </p>
        ) : null}
      </Surface>
    </main>
  );
}
