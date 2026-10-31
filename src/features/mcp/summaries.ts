import type { Cat } from "@/db/schema";
import { roundKcal } from "@/features/feeding-records/calculations";
import {
  FEEDING_MODE_LABEL,
  GIVEN_AMOUNT_LEVEL_LABEL,
  LEFTOVER_LEVEL_LABEL,
} from "@/features/feeding-records/labels";
import type { TimelineEntry } from "@/features/timeline/queries";
import {
  BCS_LABEL,
  isBodyConditionScore,
} from "@/features/weight-records/labels";

/** MCP ツール向けの猫プロフィールの要約 */
export function toCatSummary(cat: Cat) {
  return {
    id: cat.id,
    name: cat.name,
    sex: cat.sex,
    birthDate: cat.birthDate,
    birthDatePrecision: cat.birthDatePrecision,
    breed: cat.breed,
    adoptedAt: cat.adoptedAt,
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
 * できないため含めず、件数のみ返す
 */
export function toTimelineEntrySummary(entry: TimelineEntry) {
  return {
    id: entry.id,
    type: entry.type,
    occurredAt: entry.occurredAt,
    record: toRecordSummary(entry),
    mediaCount: entry.media.length,
  };
}
