import type { HouseholdMember } from "@/db/schema";

/** 家の中での権限（`household_members.role`）の表示名 */
export const HOUSEHOLD_ROLE_LABEL: Record<HouseholdMember["role"], string> = {
  owner: "オーナー",
  member: "メンバー",
};
