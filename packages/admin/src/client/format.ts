import type {
  LifeStage,
  NutritionType,
  PackageSize,
  TextureType,
} from "../catalog/form";
import type { HouseholdInvitationStatus } from "../models";

const dateTimeFormat = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

/** 日時（API の JSON では ISO 8601 の文字列）を日本時間で表示する（管理者は日本にいる前提） */
export function formatDateTime(date: string | Date) {
  return dateTimeFormat.format(new Date(date));
}

const USER_ROLE_LABEL: Record<string, string> = {
  admin: "管理者",
  member: "一般",
};

const HOUSEHOLD_ROLE_LABEL: Record<string, string> = {
  owner: "オーナー",
  member: "メンバー",
};

/** ラベルの無い値（スキーマに新しい値が増えた場合など）はそのまま表示する */
export function userRoleLabel(role: string) {
  return USER_ROLE_LABEL[role] ?? role;
}

export function householdRoleLabel(role: string) {
  return HOUSEHOLD_ROLE_LABEL[role] ?? role;
}

// メインアプリの `src/features/cats/domain/labels.ts` と同じ表記にする
const SEX_LABEL: Record<string, string> = {
  female: "メス",
  male: "オス",
  unknown: "不明",
};

export function sexLabel(sex: string) {
  return SEX_LABEL[sex] ?? sex;
}

/**
 * 猫の生年月日を、わかっている範囲に合わせて表示する（メインアプリの `formatBirthDate` と同じ表記）。
 * 年のみ・年月のみのときは、補った月・日を表示しない（例：「2020年」「2020年4月」）
 */
export function formatBirthDate(birthDate: string, precision: string) {
  const [year, month] = birthDate.split("-").map(Number);
  if (precision === "year") {
    return `${year}年`;
  }
  if (precision === "month") {
    return `${year}年${month}月`;
  }
  return birthDate;
}

const INVITATION_STATUS_LABEL: Record<HouseholdInvitationStatus, string> = {
  pending: "未使用",
  accepted: "使用済み",
  expired: "期限切れ",
};

export function invitationStatusLabel(status: HouseholdInvitationStatus) {
  return INVITATION_STATUS_LABEL[status];
}

// メインアプリの `src/features/food-products/domain/labels.ts` と同じ表記にする
export const NUTRITION_TYPE_LABEL: Record<NutritionType, string> = {
  complete: "総合栄養食",
  general: "一般食",
};

export const TEXTURE_TYPE_LABEL: Record<TextureType, string> = {
  dry: "ドライ",
  wet: "ウェット",
  soup: "スープ",
};

export const LIFE_STAGE_LABEL: Record<LifeStage, string> = {
  kitten: "キトン",
  adult: "成猫",
  senior: "シニア",
  care: "療養",
};

/**
 * メインアプリの `formatPackageAmount` と同じく「14 g/本」「1.5 kg」（1000g 以上は kg）
 */
export function formatPackageSize(size: PackageSize) {
  const amount =
    size.amountG >= 1000
      ? `${Number((size.amountG / 1000).toPrecision(12))} kg`
      : `${size.amountG} g`;
  return `${amount}${size.unit ? `/${size.unit}` : ""}`;
}

/** 対象の猫（ライフステージ・猫種）。どちらもなければ null */
export function formatTarget(product: {
  lifeStages: LifeStage[];
  targetBreed: string | null;
}) {
  const parts = [
    product.lifeStages.map((stage) => LIFE_STAGE_LABEL[stage]).join("・"),
    product.targetBreed ?? "",
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" ・ ") : null;
}
