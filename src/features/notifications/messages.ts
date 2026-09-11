import type { NotificationCandidate } from "./rules";

export type NotificationMessage = {
  title: string;
  body: string;
  url: string;
};

/** 通知候補から、通知センター（`30`）・Web Push（`29`）で使う文言と遷移先 URL を組み立てる */
export function buildNotificationMessage(
  catName: string,
  candidate: NotificationCandidate,
): NotificationMessage {
  switch (candidate.kind) {
    case "birthday_yearly":
      return {
        title: `${catName}の${candidate.years}歳の誕生日`,
        body: `${catName}が${candidate.years}歳になりました`,
        url: `/cats/${candidate.catId}`,
      };
    case "birthday_half_year":
      return {
        title: `${catName}の生後${candidate.months}ヶ月`,
        body: `${catName}が生後${candidate.months}ヶ月を迎えました`,
        url: `/cats/${candidate.catId}`,
      };
    case "days_milestone":
      return {
        title: `${catName}の生後${candidate.days}日`,
        body: `${catName}が生後${candidate.days}日を迎えました`,
        url: `/cats/${candidate.catId}`,
      };
    case "shampoo_elapsed":
      return {
        title: `${catName}のシャンプーの時期です`,
        body: `前回のシャンプーから${candidate.elapsedMonths}ヶ月が経過しました`,
        url: `/cats/${candidate.catId}/shampoo-records`,
      };
    case "weight_measurement":
      return {
        title: `${catName}の体重測定のお願い`,
        body: `前回の体重測定から${candidate.elapsedDays}日が経過しました`,
        url: `/cats/${candidate.catId}/weight-records`,
      };
    case "cleaning_due":
      return {
        title: `${candidate.targetName}のお手入れの時期です`,
        body: `${catName}の${candidate.targetName}が予定日を迎えました`,
        url: `/cats/${candidate.catId}/cleaning/targets/${candidate.targetId}/records`,
      };
  }
}
