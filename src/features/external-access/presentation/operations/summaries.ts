import type { Cat } from "@/db/schema";
import { formatCoat } from "@/features/cats/domain/coat";
import { formatNeuterStatus } from "@/features/cats/domain/labels";
import { roundKcal } from "@/features/feeding-records/domain/calculations";
import {
  FEEDING_MODE_LABEL,
  GIVEN_AMOUNT_LEVEL_LABEL,
  LEFTOVER_LEVEL_LABEL,
} from "@/features/feeding-records/domain/labels";
import type {
  RecordContributions,
  RecordContributor,
} from "@/features/record-contributors/domain/contributor";
import type { TimelineEntry } from "@/features/timeline/domain/timelineEntry";
import {
  BCS_LABEL,
  isBodyConditionScore,
} from "@/features/weight-records/domain/labels";

/**
 * MCP ツール向けの猫プロフィールの要約。避妊・去勢の状況と毛色は値だけでは意味が伝わりにくいため、
 * 表示用のラベル（未設定なら null）を添える
 */
export function toCatSummary(cat: Cat) {
  return {
    id: cat.id,
    householdId: cat.householdId,
    name: cat.name,
    sex: cat.sex,
    birthDate: cat.birthDate,
    birthDatePrecision: cat.birthDatePrecision,
    breed: cat.breed,
    adoptedAt: cat.adoptedAt,
    neuterStatus: cat.neuterStatus,
    neuterStatusLabel: formatNeuterStatus(cat.sex, cat.neuterStatus),
    coatColor: cat.coatColor,
    coatLabel: formatCoat(cat),
    // メモリー（思い出）へ移した日（YYYY-MM-DD）。null ならメモリーへ移していない
    memorialDate: cat.memorialDate,
  };
}

/**
 * 記録本体を MCP ツール向けに整える。体重記録の BCS やごはん記録の記録方法・
 * 段階での量は値だけでは意味が伝わりにくいため、表示用のラベルを添える。
 * ごはん記録の推定カロリーは画面の表示に合わせて小数第二位で四捨五入する
 */
function toRecordSummary(entry: TimelineEntry) {
  if (entry.type === "feeding") {
    const { record } = entry;
    return {
      ...record,
      modeLabel: FEEDING_MODE_LABEL[record.mode],
      items: record.items.map((item) => ({
        ...item,
        estimatedKcal:
          item.estimatedKcal === null ? null : roundKcal(item.estimatedKcal),
        givenAmountLevelLabel: item.givenAmountLevel
          ? GIVEN_AMOUNT_LEVEL_LABEL[item.givenAmountLevel]
          : null,
        leftoverLevelLabel: item.leftoverLevel
          ? LEFTOVER_LEVEL_LABEL[item.leftoverLevel]
          : null,
      })),
    };
  }
  if (entry.type === "weight") {
    const { bcs } = entry.record;
    return {
      ...entry.record,
      bcsLabel: isBodyConditionScore(bcs) ? BCS_LABEL[bcs] : null,
    };
  }
  return entry.record;
}

/**
 * MCP ツール向けのタイムラインエントリの要約。`media`（`/media/[assetId]` への
 * URL を含む）は CANSHI へのログインが必要で外部エージェントからは参照
 * できないため含めず、件数のみ返す。
 *
 * `contributions` を渡すと、記録の作成・編集の履歴（`changeHistory`）を添える。
 * 記念日のエントリは記録ではないため渡さない（`changeHistory` を含めない）
 */
export function toTimelineEntrySummary(
  entry: TimelineEntry,
  contributions?: RecordContributions | null,
) {
  return {
    id: entry.id,
    type: entry.type,
    occurredAt: entry.occurredAt,
    record: toRecordSummary(entry),
    mediaCount: entry.media.length,
    ...(contributions === undefined
      ? {}
      : { changeHistory: toChangeHistorySummary(contributions) }),
  };
}

/** 記録の作成・編集の履歴（`changeHistory`）の説明。履歴を返すツールの説明に添える */
export const CHANGE_HISTORY_DESCRIPTION =
  "changeHistory は記録の作成・編集の履歴で、保存ごとに 1 件、古い順に並ぶ。" +
  "action は create=作成、update=編集、changedAt は保存した日時。" +
  'changedBy は保存した人で、kind="user" なら userName のユーザーが CANSHI の画面から保存した。' +
  'kind="ai" なら userName のユーザーが接続を許可した AI のアプリ（clientName はアプリが名乗った名前。' +
  "わからなければ null）が保存した。" +
  "履歴を残し始める前に作られた記録には作成の履歴が無く、一度も編集されていなければ空になる。" +
  "削除の履歴は含まない。";

/**
 * MCP ツール向けの、記録の作成・編集の履歴。画面と同じく、保存した人の名前と AI のアプリの名前
 * だけを返し、ユーザー・接続の ID とアイコン画像は返さない。履歴が無い記録（`null`）は空の配列にする
 */
export function toChangeHistorySummary(
  contributions: RecordContributions | null,
) {
  if (!contributions) {
    return [];
  }
  return contributions.history.flatMap(
    ({ action, contributorIndex, changedAt }) => {
      const contributor = contributions.contributors[contributorIndex];
      return contributor
        ? [{ action, changedAt, changedBy: toChangedBySummary(contributor) }]
        : [];
    },
  );
}

function toChangedBySummary(contributor: RecordContributor) {
  if (contributor.kind === "user") {
    return { kind: "user" as const, userName: contributor.userName };
  }
  return {
    kind: "ai" as const,
    userName: contributor.userName,
    clientName: contributor.clientName,
  };
}
