const dateTimeFormat = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

/** 日時を日本時間で表示する（管理者は日本にいる前提） */
export function formatDateTime(date: Date) {
  return dateTimeFormat.format(date);
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
