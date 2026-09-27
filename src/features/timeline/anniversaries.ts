import { getBirthdayMilestone } from "@/features/cats/birthday";

/** 誕生日のエントリ。生まれた日そのもの（生後0ヶ月）も含む */
export type TimelineBirthdayRecord = {
  /** 記念日の日付（YYYY-MM-DD） */
  date: string;
  /** 生まれてからの月数。0 は生まれた日、12 の倍数は毎年の誕生日、1〜11 は1歳未満の毎月の記念日 */
  ageMonths: number;
};

/** お迎え記念日のエントリ。お迎えした日そのもの（0年）も含む */
export type TimelineAdoptionRecord = {
  /** 記念日の日付（YYYY-MM-DD） */
  date: string;
  /** お迎えしてからの年数。0 はお迎えした日 */
  years: number;
};

export type AnniversaryCat = {
  birthDate: string | null;
  adoptedAt: string | null;
};

export type MonthAnniversaries = {
  birthdays: TimelineBirthdayRecord[];
  adoptions: TimelineAdoptionRecord[];
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * 指定した年月に含まれる誕生日・お迎え記念日を返す。
 * - 誕生日: 生まれた日、毎年の誕生日、1歳未満は毎月の生まれた日と同じ日
 * - お迎え記念日: お迎えした日と、毎年のお迎えした日と同じ日
 *
 * 誕生日のお祝い（`getBirthdayMilestone`）と同じ判定を使い、生まれた日がその月にない場合
 * （31日生まれの4月、2/29 生まれの非うるう年など）は月末の日を記念日にする。
 * 表示する月の日付だけで決まり、今日の日付には依存しない（未来の記念日も含む）
 */
export function listAnniversariesForMonth(
  cat: AnniversaryCat,
  year: number,
  month: number, // 1-12
): MonthAnniversaries {
  const birthdays: TimelineBirthdayRecord[] = [];
  const adoptions: TimelineAdoptionRecord[] = [];
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${year}-${pad2(month)}-${pad2(day)}`;
    const today = { year, month, day };

    if (cat.birthDate) {
      if (date === cat.birthDate) {
        birthdays.push({ date, ageMonths: 0 });
      } else {
        const milestone = getBirthdayMilestone(cat.birthDate, today);
        if (milestone) {
          birthdays.push({
            date,
            ageMonths:
              milestone.kind === "yearly"
                ? milestone.years * 12
                : milestone.months,
          });
        }
      }
    }

    if (cat.adoptedAt) {
      if (date === cat.adoptedAt) {
        adoptions.push({ date, years: 0 });
      } else {
        // 毎年の節目の判定（月末への繰り下げを含む）は誕生日と同じ規則を使う。
        // お迎え記念日は毎月の記念日を出さないため、年単位の節目だけを拾う
        const milestone = getBirthdayMilestone(cat.adoptedAt, today);
        if (milestone?.kind === "yearly") {
          adoptions.push({ date, years: milestone.years });
        }
      }
    }
  }

  return { birthdays, adoptions };
}

/** 誕生日エントリの表示用の文言（例: 「生まれた日」「3歳の誕生日」「生後3ヶ月」） */
export function formatBirthdayRecord(record: TimelineBirthdayRecord): string {
  if (record.ageMonths === 0) {
    return "生まれた日";
  }
  if (record.ageMonths % 12 === 0) {
    return `${record.ageMonths / 12}歳の誕生日`;
  }
  return `生後${record.ageMonths}ヶ月`;
}

/** お迎え記念日エントリの表示用の文言（例: 「お迎えした日」「お迎えして3年」） */
export function formatAdoptionRecord(record: TimelineAdoptionRecord): string {
  return record.years === 0 ? "お迎えした日" : `お迎えして${record.years}年`;
}
