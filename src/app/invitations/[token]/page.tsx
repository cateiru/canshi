import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui";
import { HouseholdIcon } from "@/components/ui/RecordIcons/RecordIcons";
import { requireUser } from "@/features/auth/session";
import { acceptHouseholdInvitationAction } from "@/features/households/actions";
import { HouseholdInvitationAcceptButton } from "@/features/households/HouseholdInvitationAcceptButton";
import { getHouseholdInvitationPreview } from "@/features/households/invitations";
import { formatDateTimeUtc, getNaiveUtcNow } from "@/features/shared/datetime";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import { Surface } from "@/features/shared/Surface";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "家への招待 | CANSHI",
  // 招待 URL にはトークンが含まれるため、遷移先へ URL を送らない
  referrer: "no-referrer",
};

export const dynamic = "force-dynamic";

type InvitationPageProps = {
  params: Promise<{ token: string }>;
};

/**
 * 家への招待 URL を開いたときのページ。リンクのプレビューや先読みで招待が使われないよう、
 * 開いただけでは参加せず、「参加する」を押したときに参加する。
 * 未ログインのときは middleware がログイン画面へ送り、ログイン後にこのページへ戻る
 */
export default async function InvitationPage({ params }: InvitationPageProps) {
  const { token } = await params;
  const user = await requireUser();
  const preview = await getHouseholdInvitationPreview(token, user.id);

  return (
    <main className={styles.main}>
      <RecordPageHeading icon={HouseholdIcon}>家への招待</RecordPageHeading>

      {preview.status === "valid" ? (
        <Surface className={styles.content}>
          <p>
            {preview.createdByName}さんから「
            <strong>{preview.householdName}</strong>
            」に招待されています。参加すると、この家の猫の記録を見たり書いたりできるようになります。
          </p>
          <p className={styles.note}>
            有効期限: {formatDateTimeUtc(getNaiveUtcNow(preview.expiresAt))}
          </p>
          <div className={styles.actions}>
            <HouseholdInvitationAcceptButton
              householdName={preview.householdName}
              action={acceptHouseholdInvitationAction.bind(null, token)}
            />
          </div>
        </Surface>
      ) : preview.status === "member" ? (
        <Surface className={styles.content}>
          <p>
            あなたはすでに「<strong>{preview.householdName}</strong>
            」のメンバーです。
          </p>
          <div className={styles.actions}>
            <ButtonLink href={`/settings/households/${preview.householdId}`}>
              家の設定を開く
            </ButtonLink>
          </div>
        </Surface>
      ) : (
        <Surface className={styles.content}>
          <p>
            この招待 URL
            は使えません。期限が切れているか、すでに使われているか、無効化されています。
          </p>
          <p className={styles.note}>
            招待した人に、新しい招待 URL を発行してもらってください。
          </p>
          <div className={styles.actions}>
            <ButtonLink href="/home">トップへ</ButtonLink>
          </div>
        </Surface>
      )}
    </main>
  );
}
