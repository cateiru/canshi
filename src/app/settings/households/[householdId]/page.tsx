import type { Metadata } from "next";
import { Badge, Breadcrumb } from "@/components/ui";
import { HouseholdIcon } from "@/components/ui/RecordIcons/RecordIcons";
import { requireHouseholdAccess } from "@/features/auth/session";
import {
  createHouseholdInvitationAction,
  leaveHouseholdAction,
  removeHouseholdMemberAction,
  revokeHouseholdInvitationAction,
  transferHouseholdOwnershipAction,
  updateHouseholdNameAction,
} from "@/features/households/actions";
import { HouseholdInvitationIssueButton } from "@/features/households/HouseholdInvitationIssueButton";
import { HouseholdMemberActionButton } from "@/features/households/HouseholdMemberActionButton";
import { HouseholdNameForm } from "@/features/households/HouseholdNameForm";
import {
  HOUSEHOLD_INVITATION_MAX_AGE_SECONDS,
  listPendingHouseholdInvitations,
} from "@/features/households/invitations";
import { HOUSEHOLD_ROLE_LABEL } from "@/features/households/labels";
import { listHouseholdMembers } from "@/features/households/queries";
import { formatDateTimeUtc, getNaiveUtcNow } from "@/features/shared/datetime";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import { Surface } from "@/features/shared/Surface";
import { UserAvatar } from "@/features/users/UserAvatar";
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
  const invitations = isOwner
    ? await listPendingHouseholdInvitations(household.id)
    : [];

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
                  <UserAvatar
                    name={member.name}
                    iconMediaAssetId={member.iconMediaAssetId}
                  />
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

      {isOwner ? (
        <Surface title="招待" titleId="household-invitations-heading" gap="md">
          <p className={styles.note}>
            招待 URL を開いた人が、この家にメンバーとして参加できます。1 つの
            URL で参加できるのは 1 人だけで、発行から{" "}
            {HOUSEHOLD_INVITATION_MAX_AGE_SECONDS / (24 * 60 * 60)}{" "}
            日で使えなくなります。
          </p>
          <div>
            <HouseholdInvitationIssueButton
              householdName={household.name}
              action={createHouseholdInvitationAction.bind(null, household.id)}
            />
          </div>
          {invitations.length > 0 ? (
            <ul className={styles.members} aria-label="まだ使われていない招待">
              {invitations.map((invitation) => (
                <li key={invitation.id} className={styles.member}>
                  <div className={styles.invitationInfo}>
                    <span>
                      有効期限:{" "}
                      {formatDateTimeUtc(getNaiveUtcNow(invitation.expiresAt))}
                    </span>
                    <span className={styles.note}>
                      {formatDateTimeUtc(getNaiveUtcNow(invitation.createdAt))}{" "}
                      に{invitation.createdByName}が発行
                    </span>
                  </div>
                  <HouseholdMemberActionButton
                    label="無効化する"
                    title="招待の無効化"
                    description="この招待を無効化しますか？無効化した招待 URL を開いても、家には参加できなくなります。"
                    variant="danger"
                    successMessage="招待を無効化しました"
                    action={revokeHouseholdInvitationAction.bind(
                      null,
                      household.id,
                      invitation.id,
                    )}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.note}>まだ使われていない招待はありません。</p>
          )}
        </Surface>
      ) : null}
    </main>
  );
}
