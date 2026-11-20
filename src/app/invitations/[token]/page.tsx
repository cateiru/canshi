import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui";
import { HouseholdIcon } from "@/components/ui/RecordIcons/RecordIcons";
import { requireUser } from "@/features/auth/presentation/session";
import { getHouseholdInvitationPreview } from "@/features/households/application/invitations";
import { acceptHouseholdInvitationAction } from "@/features/households/presentation/actions";
import { HouseholdInvitationAcceptButton } from "@/features/households/presentation/HouseholdInvitationAcceptButton";
import { formatDateTimeUtc, getNaiveUtcNow } from "@/features/shared/datetime";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import { Surface } from "@/features/shared/Surface";
import { UserAvatar } from "@/features/users/presentation/UserAvatar";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "家への招待",
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
          <div className={styles.diagram}>
            <div className={styles.node}>
              <UserAvatar
                name={user.name}
                iconMediaAssetId={user.iconMediaAssetId}
                size="md"
              />
              <span className={styles.nodeName}>{user.name}</span>
            </div>
            <span className={styles.connector} aria-hidden="true" />
            <div className={styles.node}>
              <span className={styles.householdIcon}>
                <HouseholdIcon size="60%" aria-hidden="true" />
              </span>
              <span className={styles.nodeName}>{preview.householdName}</span>
            </div>
          </div>
          <p className={styles.message}>
            <UserAvatar
              name={preview.createdByName}
              iconMediaAssetId={preview.createdByIconMediaAssetId}
              iconUrl={
                preview.createdByIconMediaAssetId
                  ? inviterIconUrl(token, preview.createdByIconMediaAssetId)
                  : undefined
              }
              size="xs"
              className={styles.inviterAvatar}
            />
            <span>
              <strong>{preview.createdByName}</strong>さんから「
              <strong>{preview.householdName}</strong>」へ招待されています。
            </span>
          </p>
          <p className={styles.description}>
            参加すると、この家のねこの記録を見たり書いたりできるようになります。
          </p>
          <p className={styles.expires}>
            有効期限: {formatDateTimeUtc(getNaiveUtcNow(preview.expiresAt))}
          </p>
          <div className={styles.decision}>
            <HouseholdInvitationAcceptButton
              householdName={preview.householdName}
              action={acceptHouseholdInvitationAction.bind(null, token)}
            />
            <ButtonLink href="/home">キャンセル</ButtonLink>
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

/**
 * 招待した人のアイコン画像の URL（`./inviter-icon/route.ts`）。アイコンを変えたときに
 * 古い画像のキャッシュを使わないよう、画像の ID を付ける
 */
function inviterIconUrl(token: string, iconMediaAssetId: string) {
  return `/invitations/${encodeURIComponent(token)}/inviter-icon?v=${encodeURIComponent(iconMediaAssetId)}`;
}
