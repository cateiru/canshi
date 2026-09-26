export type CalendarDate = {
  year: number;
  month: number;
  day: number;
};

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** 端末のローカル日付（`Date` のローカル時刻）を暦日にする */
export function toLocalCalendarDate(date: Date): CalendarDate {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  };
}

/**
 * 今日が誕生日なら、迎えた年齢（満年齢）を返す。誕生日でなければ `null`。
 * 誕生日通知（`evaluateBirthdayYearly`）と同じく、生まれた日そのもの（0歳）は対象外とし、
 * 2/29 生まれは非うるう年の 2/28 を誕生日として扱う
 */
export function getBirthdayYears(
  birthDate: string,
  today: CalendarDate,
): number | null {
  const [birthYear, birthMonth, birthDay] = birthDate.split("-").map(Number);

  const matchesExactDate = today.month === birthMonth && today.day === birthDay;
  const matchesNonLeapFallback =
    birthMonth === 2 &&
    birthDay === 29 &&
    !isLeapYear(today.year) &&
    today.month === 2 &&
    today.day === 28;

  if (!matchesExactDate && !matchesNonLeapFallback) {
    return null;
  }

  const years = today.year - birthYear;
  return years >= 1 ? years : null;
}

/**
 * 猫の年齢を人間の年齢に換算した目安を返す。
 * 一般によく使われる換算（1歳≒15歳、2歳≒24歳、以降は1年ごとに4歳ずつ加算）に従う
 */
export function toHumanAge(catYears: number): number {
  if (catYears <= 1) {
    return 15;
  }
  return 24 + (catYears - 2) * 4;
}

/**
 * 年齢に応じたライフステージのひとこと。
 * 区切りは一般的なライフステージ（〜6歳: 成猫期、7〜10歳: 中年期、11歳〜: シニア期）に合わせる
 */
export function getLifeStageMessage(catYears: number): string {
  if (catYears <= 6) {
    return "心も体も充実した成猫期。遊びや運動でたくさん体を動かしてあげましょう。";
  }
  if (catYears <= 10) {
    return "落ち着きの出てくる中年期。年に1回の健康診断で体調の変化に気づけるようにしましょう。";
  }
  return "ゆったり過ごすシニア期。段差を減らすなど、暮らしやすい環境を整えてあげましょう。";
}

/** この端末でお祝い済みかどうかを覚えておく localStorage のキー */
export function birthdayCelebratedStorageKey(
  catId: string,
  years: number,
): string {
  return `canshi:birthday-celebrated:${catId}:${years}`;
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
