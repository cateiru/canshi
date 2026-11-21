import { segment } from "./api";

/** ユーザーの詳細ページのパス */
export function userPath(userId: string) {
  return `/users/${segment(userId)}`;
}

/** 家の詳細ページのパス */
export function householdPath(householdId: string) {
  return `/households/${segment(householdId)}`;
}
