export type CalendarDate = {
  year: number;
  month: number;
  day: number;
};

/** 端末のローカル日付（`Date` のローカル時刻）を暦日にする */
export function toLocalCalendarDate(date: Date): CalendarDate {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  };
}

/** お祝いする節目。1歳以上は毎年の誕生日、1歳未満は毎月の記念日 */
export type BirthdayMilestone =
  | { kind: "yearly"; years: number }
  | { kind: "monthly"; months: number };

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * 今日がお祝いする節目なら、その節目を返す。節目でなければ `null`。
 * - 1歳以上は、毎年の誕生日に満年齢でお祝いする
 * - 1歳未満は、毎月の生まれた日と同じ日に生後の月数でお祝いする
 * - 生まれた日そのもの（生後0ヶ月）は対象外
 *
 * 生まれた日がその月にない場合（31日生まれの4月、2/29 生まれの非うるう年など）は、
 * 月末の日を節目の日として扱う。2/29 生まれを非うるう年の 2/28 にお祝いするのは、
 * 誕生日通知（`evaluateBirthdayYearly`）と同じ扱い
 */
export function getBirthdayMilestone(
  birthDate: string,
  today: CalendarDate,
): BirthdayMilestone | null {
  const [birthYear, birthMonth, birthDay] = birthDate.split("-").map(Number);

  const anniversaryDay = Math.min(
    birthDay,
    daysInMonth(today.year, today.month),
  );
  if (today.day !== anniversaryDay) {
    return null;
  }

  const months = (today.year - birthYear) * 12 + (today.month - birthMonth);
  if (months < 1) {
    return null;
  }
  if (months % 12 === 0) {
    return { kind: "yearly", years: months / 12 };
  }
  if (months < 12) {
    return { kind: "monthly", months };
  }
  return null;
}

/** 節目の年齢を表示用の文字列にする（例: 「3歳」「生後3ヶ月」） */
export function formatMilestoneAge(milestone: BirthdayMilestone): string {
  return milestone.kind === "yearly"
    ? `${milestone.years}歳`
    : `生後${milestone.months}ヶ月`;
}

/**
 * 生後1〜11ヶ月の人間換算。一般によく使われる換算表（1ヶ月≒1歳、2ヶ月≒3歳、
 * 3ヶ月≒5歳、6ヶ月≒9歳、9ヶ月≒13歳、1年≒15歳）の間の月は、前後から線形に補間して丸めた値
 */
const KITTEN_HUMAN_AGE_BY_MONTH = [1, 3, 5, 6, 8, 9, 10, 12, 13, 14, 14];

/**
 * 猫の年齢を人間の年齢に換算した目安を返す。
 * 1歳以上は一般によく使われる換算（1歳≒15歳、2歳≒24歳、以降は1年ごとに4歳ずつ加算）に従う
 */
export function toHumanAge(milestone: BirthdayMilestone): number {
  if (milestone.kind === "monthly") {
    return KITTEN_HUMAN_AGE_BY_MONTH[milestone.months - 1];
  }
  if (milestone.years <= 1) {
    return 15;
  }
  return 24 + (milestone.years - 2) * 4;
}

/**
 * 年齢に応じたライフステージのひとこと。
 * 区切りは一般的なライフステージ（〜1歳: 子猫期、〜6歳: 成猫期、7〜10歳: 中年期、
 * 11歳〜: シニア期）に合わせる
 */
export function getLifeStageMessage(milestone: BirthdayMilestone): string {
  if (milestone.kind === "monthly") {
    return "ぐんぐん育つ子猫期。体重がしっかり増えているか、こまめに記録してあげましょう。";
  }
  if (milestone.years <= 6) {
    return "心も体も充実した成猫期。遊びや運動でたくさん体を動かしてあげましょう。";
  }
  if (milestone.years <= 10) {
    return "落ち着きの出てくる中年期。年に1回の健康診断で体調の変化に気づけるようにしましょう。";
  }
  return "ゆったり過ごすシニア期。段差を減らすなど、暮らしやすい環境を整えてあげましょう。";
}

/** この端末でお祝い済みかどうかを覚えておく localStorage のキー（猫・節目ごと） */
export function birthdayCelebratedStorageKey(
  catId: string,
  milestone: BirthdayMilestone,
): string {
  const count =
    milestone.kind === "yearly" ? milestone.years : milestone.months;
  return `canshi:birthday-celebrated:${catId}:${milestone.kind}:${count}`;
}

/** お祝いの表示に必要な猫の情報。クライアントへ渡す値を必要な列に絞るための型 */
export type BirthdayCelebrationCat = {
  id: string;
  name: string;
  birthDate: string | null;
  profileMediaAssetId: string | null;
  profileCropX: number | null;
  profileCropY: number | null;
  profileCropZoom: number | null;
  profileCropRotation: number | null;
};

export function toBirthdayCelebrationCat(
  cat: BirthdayCelebrationCat,
): BirthdayCelebrationCat {
  return {
    id: cat.id,
    name: cat.name,
    birthDate: cat.birthDate,
    profileMediaAssetId: cat.profileMediaAssetId,
    profileCropX: cat.profileCropX,
    profileCropY: cat.profileCropY,
    profileCropZoom: cat.profileCropZoom,
    profileCropRotation: cat.profileCropRotation,
  };
}
