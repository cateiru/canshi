import type {
  HouseholdNotificationCandidate,
  NotificationCandidate,
  SymptomOngoingCandidate,
} from "./rules";

const SYMPTOM_STATUS_PHRASE: Record<SymptomOngoingCandidate["status"], string> =
  {
    ongoing: "継続中",
    improving: "改善中",
  };

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
    case "symptom_ongoing":
      return {
        title: `${catName}の「${candidate.symptomType}」は解消しましたか？`,
        body: `「${candidate.symptomType}」の症状が「${SYMPTOM_STATUS_PHRASE[candidate.status]}」のまま${candidate.elapsedMonths}ヶ月が経過しました`,
        url: `/cats/${candidate.catId}/symptoms/${candidate.symptomId}/edit`,
      };
  }
}

/**
 * 家についての通知の候補から、文言と遷移先 URL を組み立てる。遷移先は、家の猫が 1 匹だけなら
 * その猫のごはん記録の追加画面、複数いれば記録する猫を選べる猫一覧にする
 */
export function buildHouseholdNotificationMessage(
  candidate: HouseholdNotificationCandidate,
  catIds: readonly string[],
): NotificationMessage {
  const url =
    catIds.length === 1 ? `/cats/${catIds[0]}/feeding-records/new` : "/cats";
  switch (candidate.kind) {
    case "feeding_time":
      return {
        title: "ごはんの時間です",
        body: `${candidate.time}のごはんの時間になりました。ごはんをあげたら記録しておきましょう`,
        url,
      };
    case "feeding_not_recorded":
      return {
        title: "ごはんはあげましたか？",
        body: `${candidate.time}のごはんの記録がありません。あげていたら記録しておきましょう`,
        url,
      };
  }
}
