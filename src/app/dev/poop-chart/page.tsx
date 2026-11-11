import { notFound } from "next/navigation";
import type { PoopRecord } from "@/db/schema";
import { toPoopChartPoints } from "@/features/poop-records/presentation/chart";
import { PoopRecordChart } from "@/features/poop-records/presentation/PoopRecordChart";
import styles from "./page.module.css";

// グラフは「今日」を右端にした日ごとの列で描くため、VRT では今日を固定する
const NOW = "2026-10-31T12:00:00.000Z";
const DAY_MS = 24 * 60 * 60 * 1000;
const CONSISTENCIES: PoopRecord["consistency"][] = [
  "normal",
  "soft",
  "normal",
  "hard",
  "liquid",
];

/** 半年ぶん、朝・夜を中心に 1 日 0〜3 回の記録を決まった並びで作る */
function buildFixtureRecords(): Pick<
  PoopRecord,
  "id" | "occurredAt" | "consistency"
>[] {
  const records: Pick<PoopRecord, "id" | "occurredAt" | "consistency">[] = [];
  const todayMs = Date.parse("2026-10-31T00:00:00.000Z");
  for (let daysAgo = 0; daysAgo < 180; daysAgo++) {
    const dayMs = todayMs - daysAgo * DAY_MS;
    const minutesList = [
      daysAgo % 5 !== 3 ? 7 * 60 + ((daysAgo * 17) % 120) : null,
      daysAgo % 3 !== 1 ? 20 * 60 + ((daysAgo * 29) % 150) : null,
      daysAgo % 11 === 0 ? 13 * 60 + ((daysAgo * 7) % 60) : null,
    ];
    for (const minutes of minutesList) {
      if (minutes === null) {
        continue;
      }
      records.push({
        id: `dev-poop-${records.length}`,
        occurredAt: new Date(dayMs + minutes * 60 * 1000),
        consistency:
          CONSISTENCIES[records.length % CONSISTENCIES.length] ?? "normal",
      });
    }
  }
  return records;
}

/**
 * うんち記録の「うんちの時間帯」のグラフを、固定の今日・記録で表示する開発用ページ。
 * 本物の一覧は実行日を今日として期間を切るため、VRT（e2e/vrt.spec.ts）では
 * こちらを撮ってグラフ本体の見た目を確かめる。本番では表示しない
 */
export default function PoopChartDevPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <main className={styles.main}>
      <PoopRecordChart
        points={toPoopChartPoints(buildFixtureRecords())}
        now={NOW}
      />
    </main>
  );
}
