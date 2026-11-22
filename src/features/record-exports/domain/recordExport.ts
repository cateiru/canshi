import type {
  RecordExport,
  RecordExportFailureReason,
  RecordExportStatus,
} from "@/db/schema";
import { RUNNING_RECORD_EXPORT_STATUSES } from "@/db/schema";
import { EXPENSE_MEDIA_TYPE } from "@/features/expenses/domain/media";
import { HOSPITAL_VISIT_MEDIA_TYPE } from "@/features/hospital-visits/domain/media";
import type { MediaRecordType } from "@/features/media/domain/recordTypes";
import { MEDICATION_MEDIA_TYPE } from "@/features/medications/domain/media";
import { MEMO_RECORD_MEDIA_TYPE } from "@/features/memo-records/domain/media";
import { POOP_RECORD_MEDIA_TYPE } from "@/features/poop-records/domain/media";
import { SYMPTOM_MEDIA_TYPE } from "@/features/symptoms/domain/media";
import { VOMIT_RECORD_MEDIA_TYPE } from "@/features/vomit-records/domain/media";

/*
 * 記録の出力（#286）の規則。家の記録を種類ごとの CSV にし、写真・動画とあわせて zip にまとめる
 */

/**
 * 出力できる記録の種類。並びは猫のページの記録の導線（`RECORD_NAV_ITEMS`）に合わせ、
 * zip の中の CSV もこの順に並べる
 */
export const RECORD_EXPORT_TYPES = [
  "feeding",
  "poop",
  "weight",
  "vomit",
  "water",
  "shampoo",
  "brushing",
  "cleaning",
  "symptom",
  "medication",
  "hospitalVisit",
  "expense",
  "memo",
] as const;

export type RecordExportType = (typeof RECORD_EXPORT_TYPES)[number];

/** 画面に出す記録の名前。猫のページの記録の導線と同じ呼び方にする */
export const RECORD_EXPORT_TYPE_LABEL: Record<RecordExportType, string> = {
  feeding: "ごはん記録",
  poop: "うんち記録",
  weight: "体重記録",
  vomit: "嘔吐記録",
  water: "水の記録",
  shampoo: "シャンプー記録",
  brushing: "ブラッシング記録",
  cleaning: "掃除記録",
  symptom: "症状記録",
  medication: "服薬記録",
  hospitalVisit: "通院記録",
  expense: "支出記録",
  memo: "メモ",
};

/**
 * 写真・動画を添付できる記録の種類と、その `media_assets.record_type`。
 * 服薬記録は、服薬予定（`medications`）に添付した写真を含める（投薬の記録には添付できない）
 */
export const RECORD_EXPORT_MEDIA_TYPES: Partial<
  Record<RecordExportType, MediaRecordType>
> = {
  poop: POOP_RECORD_MEDIA_TYPE,
  vomit: VOMIT_RECORD_MEDIA_TYPE,
  symptom: SYMPTOM_MEDIA_TYPE,
  medication: MEDICATION_MEDIA_TYPE,
  hospitalVisit: HOSPITAL_VISIT_MEDIA_TYPE,
  expense: EXPENSE_MEDIA_TYPE,
  memo: MEMO_RECORD_MEDIA_TYPE,
};

export function isRecordExportType(value: unknown): value is RecordExportType {
  return (
    typeof value === "string" &&
    (RECORD_EXPORT_TYPES as readonly string[]).includes(value)
  );
}

/** 記録の種類を、重複を除いて `RECORD_EXPORT_TYPES` の順に並べる。知らない種類は除く */
export function normalizeRecordExportTypes(
  types: readonly unknown[],
): RecordExportType[] {
  return RECORD_EXPORT_TYPES.filter((type) => types.includes(type));
}

/**
 * 処理中のまま、これより長く経った出力は、バッチが止まったものとして失敗として扱う。
 * バッチの起動や失敗の記録ができなかったときに、家の出力がいつまでも処理中のまま
 * 新しい出力を依頼できなくなるのを防ぐ
 */
export const RECORD_EXPORT_STALE_AFTER_MS = 60 * 60 * 1000;

/** 処理中として扱う出力の作成日時の下限。これより前に作られた処理中の出力は止まったものとみなす */
export function recordExportStaleBefore(now: Date): Date {
  return new Date(now.getTime() - RECORD_EXPORT_STALE_AFTER_MS);
}

/** 画面に出す出力の状態 */
export type RecordExportDisplayStatus = "running" | "completed" | "failed";

/**
 * 出力の状態を、画面に出す状態にする。処理中のまま `RECORD_EXPORT_STALE_AFTER_MS` を過ぎたものは
 * 失敗として扱う（次に出力を依頼したときに、DB の状態も失敗にする）
 */
export function recordExportDisplayStatus(
  recordExport: Pick<RecordExport, "status" | "createdAt">,
  now: Date,
): RecordExportDisplayStatus {
  if (isRunningStatus(recordExport.status)) {
    return recordExport.createdAt < recordExportStaleBefore(now)
      ? "failed"
      : "running";
  }
  return recordExport.status === "completed" ? "completed" : "failed";
}

function isRunningStatus(status: RecordExportStatus): boolean {
  return (RUNNING_RECORD_EXPORT_STATUSES as readonly string[]).includes(status);
}

export const RECORD_EXPORT_STATUS_LABEL: Record<
  RecordExportDisplayStatus,
  string
> = {
  running: "処理中",
  completed: "完了",
  failed: "失敗",
};

/** 出力できなかった理由の説明 */
export function recordExportFailureMessage(
  reason: RecordExportFailureReason | null,
): string {
  return reason === "too_large"
    ? "ファイルが大きすぎるため出力できませんでした。写真・動画を含めずに出力するか、記録の種類を減らしてください。"
    : "出力できませんでした。時間をおいてもう一度お試しください。";
}

/** zip を置く R2 のオブジェクトキー。記録のメディア（`{recordType}/...`）と重ならないプレフィックスにする */
export function recordExportObjectKey(recordExportId: string): string {
  return `record_exports/${recordExportId}.zip`;
}

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * ダウンロードするときのファイル名。依頼した日時（日本時間）を入れる。
 * 展開する環境によらず文字化けしないよう、英数字だけにする
 */
export function recordExportFileName(createdAt: Date): string {
  const stamp = new Date(createdAt.getTime() + JST_OFFSET_MS)
    .toISOString()
    .slice(0, 16)
    .replace(/[-:]/g, "")
    .replace("T", "-");
  return `canshi-records-${stamp}.zip`;
}
