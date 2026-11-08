import type { HouseholdMember } from "@/db/schema";

/** 家の中での権限（`household_members.role`）の表示名 */
export const HOUSEHOLD_ROLE_LABEL: Record<HouseholdMember["role"], string> = {
  owner: "オーナー",
  member: "メンバー",
};

/** 猫のいる家を削除しようとしたときの案内。猫の記録は猫の削除に任せ、家の削除では扱わない */
export const HOUSEHOLD_HAS_CATS_MESSAGE =
  "この家にはねこがいるため削除できません。先にこの家のねこをすべて削除してください。";
