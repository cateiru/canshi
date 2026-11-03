import type {
  Household,
  HouseholdInvitation,
  HouseholdMember,
} from "@/db/schema";

/**
 * 家（エンティティ）。メンバー（`HouseholdMember`）を持ち、オーナーはいつも 1 人。
 * 猫・支出・ごはん商品などは家に属し、家のメンバーだけが参照・編集できる
 */
/** 家への招待（エンティティ）。1 つの招待で参加できるのは 1 人だけ */
export type { Household, HouseholdInvitation, HouseholdMember };

/** 招待 URL の有効期間。発行から延長しない */
export const HOUSEHOLD_INVITATION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

/** 招待 URL のパス。トークンは発行したときにしか分からないため、URL もそのときに組み立てる */
export function householdInvitationPath(token: string) {
  return `/invitations/${token}`;
}

/** `now` に発行した招待の有効期限 */
export function householdInvitationExpiresAt(now: Date): Date {
  return new Date(now.getTime() + HOUSEHOLD_INVITATION_MAX_AGE_SECONDS * 1000);
}

/** 招待 URL を開いたユーザーに見せる、招待の状態を決めるための項目 */
export type HouseholdInvitationLookup = {
  householdId: string;
  householdName: string;
  createdByName: string;
  expiresAt: Date;
  acceptedByUserId: string | null;
  /** 開いたユーザーがすでにその家のメンバーか */
  isMember: boolean;
};

export type HouseholdInvitationPreview =
  /** 存在しない・期限切れ・使用済み・無効化済みの招待。どれなのかは区別しない */
  | { status: "invalid" }
  /** 開いたユーザーがすでにその家のメンバー */
  | { status: "member"; householdId: string; householdName: string }
  | {
      status: "valid";
      householdName: string;
      createdByName: string;
      expiresAt: Date;
    };

/** 招待 URL を開いたユーザーに、招待された家と参加できるかどうかを返す */
export function toHouseholdInvitationPreview(
  invitation: HouseholdInvitationLookup | null,
  now: Date,
): HouseholdInvitationPreview {
  if (!invitation) {
    return { status: "invalid" };
  }
  // 参加済みのユーザーがもう一度開いた場合も、使用済みではなく参加済みとして案内する
  if (invitation.isMember) {
    return {
      status: "member",
      householdId: invitation.householdId,
      householdName: invitation.householdName,
    };
  }
  if (invitation.acceptedByUserId !== null || invitation.expiresAt <= now) {
    return { status: "invalid" };
  }
  return {
    status: "valid",
    householdName: invitation.householdName,
    createdByName: invitation.createdByName,
    expiresAt: invitation.expiresAt,
  };
}
