import type {
  BrushingRecord,
  CleaningRecord,
  ExpenseRecord,
  FeedingRecord,
  FeedingRecordItem,
  FoodAmountUnit,
  HospitalVisit,
  Medication,
  MedicationDose,
  MemoRecord,
  PoopRecord,
  ShampooRecord,
  Symptom,
  VomitRecord,
  WaterRecord,
  WeightRecord,
} from "@/db/schema";
import { SHED_AMOUNT_LABEL } from "@/features/brushing-records/domain/labels";
import { EXPENSE_CATEGORY_LABEL } from "@/features/expenses/domain/labels";
import { roundKcal } from "@/features/feeding-records/domain/calculations";
import {
  FEEDING_MODE_LABEL,
  GIVEN_AMOUNT_LEVEL_LABEL,
  LEFTOVER_LEVEL_LABEL,
} from "@/features/feeding-records/domain/labels";
import { CONSISTENCY_LABEL } from "@/features/poop-records/domain/labels";
import { formatDateTimeUtc, getNaiveUtcNow } from "@/features/shared/datetime";
import { STATUS_LABEL as SYMPTOM_STATUS_LABEL } from "@/features/symptoms/domain/labels";
import {
  MEASUREMENT_METHOD_LABEL,
  SUBJECTIVE_AMOUNT_LABEL,
} from "@/features/water-records/domain/labels";
import {
  BCS_LABEL,
  INPUT_METHOD_LABEL,
  isBodyConditionScore,
} from "@/features/weight-records/domain/labels";
import type { CsvCell, CsvFile } from "./csv";
import type { RecordExportType } from "./recordExport";

/*
 * 記録の種類ごとの CSV の中身。列の名前は記録のフォームの項目名に合わせる。
 * 日時は記録の発生日時（naive UTC）をそのまま「YYYY-MM-DD HH:mm」で書く（画面の表示と同じ日本時間の数字）
 */

/** 記録の ID ごとの、zip の中の写真・動画のパス。写真・動画を含めないときは undefined */
export type ExportMediaPaths = ReadonlyMap<string, readonly string[]>;

type WithCatName = { catName: string };

/** 記録の種類ごとの CSV のファイル名（拡張子なし）。写真・動画のフォルダ名にも使う */
export const RECORD_EXPORT_FILE_BASE_NAMES: Record<RecordExportType, string> = {
  feeding: "feeding_records",
  poop: "poop_records",
  weight: "weight_records",
  vomit: "vomit_records",
  water: "water_records",
  shampoo: "shampoo_records",
  brushing: "brushing_records",
  cleaning: "cleaning_records",
  symptom: "symptoms",
  medication: "medications",
  hospitalVisit: "hospital_visits",
  expense: "expenses",
  memo: "memo_records",
};

/** 服薬記録の、投薬の記録の CSV のファイル名（拡張子なし）。服薬予定とは別のファイルにする */
const MEDICATION_DOSE_FILE_BASE_NAME = "medication_doses";

const MEDIA_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

/**
 * 写真・動画の zip の中のパス。`photos/{CSV のファイル名}/{記録の ID}-{記録の中の順番}.{拡張子}` にし、
 * CSV の「写真・動画」の列からたどれるようにする
 */
export function recordExportMediaPath(
  type: RecordExportType,
  recordId: string,
  index: number,
  mimeType: string,
): string {
  const extension = MEDIA_EXTENSIONS[mimeType] ?? "bin";
  return `photos/${RECORD_EXPORT_FILE_BASE_NAMES[type]}/${recordId}-${index + 1}.${extension}`;
}

const MEDIA_COLUMN = "写真・動画";

function csvFile(
  baseName: string,
  columns: string[],
  rows: CsvCell[][],
  media: { paths: ExportMediaPaths | undefined; recordIds: string[] },
): CsvFile {
  const { paths, recordIds } = media;
  if (!paths) {
    return { fileName: `${baseName}.csv`, columns, rows };
  }
  // 同じ記録の写真・動画は 1 つのセルに改行で区切って並べる
  return {
    fileName: `${baseName}.csv`,
    columns: [...columns, MEDIA_COLUMN],
    rows: rows.map((row, index) => [
      ...row,
      paths.get(recordIds[index])?.join("\n") ?? null,
    ]),
  };
}

function dateTime(date: Date | null): string | null {
  return date ? formatDateTimeUtc(date) : null;
}

/** 実際の日時（`unixepoch()` で保存した値）を、日本時間の「YYYY-MM-DD HH:mm」で書く */
function timestampJst(date: Date | null): string | null {
  return date ? formatDateTimeUtc(getNaiveUtcNow(date)) : null;
}

function yesNo(value: boolean): string {
  return value ? "はい" : "いいえ";
}

export type FeedingExportRow = FeedingRecord &
  WithCatName & {
    items: (FeedingRecordItem & {
      productName: string;
      /** 商品の量の単位。量・推定摂取量はこの単位の値 */
      amountUnit: FoodAmountUnit;
    })[];
  };

/**
 * ごはん記録。商品ごとに 1 行にし、同じ記録の行は同じ ID にする。
 * 量・推定摂取量は商品の単位（g・ml）の値で、単位の列に書く
 */
export function feedingCsvFile(rows: FeedingExportRow[]): CsvFile {
  const columns = [
    "ID",
    "ねこ",
    "日時",
    "記録方法",
    "商品",
    "単位",
    "与えた量",
    "残した量",
    "推定摂取量",
    "推定カロリー（kcal）",
    "与えた量（段階）",
    "残した量（段階）",
    "備考",
  ];
  const lines: CsvCell[][] = rows.flatMap((record) => {
    const head = [
      record.id,
      record.catName,
      dateTime(record.occurredAt),
      FEEDING_MODE_LABEL[record.mode],
    ];
    if (record.items.length === 0) {
      return [
        [...head, null, null, null, null, null, null, null, null, record.memo],
      ];
    }
    return record.items.map((item) => [
      ...head,
      item.productName,
      item.amountUnit,
      item.givenAmountG,
      item.leftoverAmountG,
      item.estimatedIntakeG,
      item.estimatedKcal == null ? null : roundKcal(item.estimatedKcal),
      item.givenAmountLevel
        ? GIVEN_AMOUNT_LEVEL_LABEL[item.givenAmountLevel]
        : null,
      item.leftoverLevel ? LEFTOVER_LEVEL_LABEL[item.leftoverLevel] : null,
      record.memo,
    ]);
  });
  return {
    fileName: `${RECORD_EXPORT_FILE_BASE_NAMES.feeding}.csv`,
    columns,
    rows: lines,
  };
}

export function poopCsvFile(
  rows: (PoopRecord & WithCatName)[],
  mediaPaths: ExportMediaPaths | undefined,
): CsvFile {
  return csvFile(
    RECORD_EXPORT_FILE_BASE_NAMES.poop,
    [
      "ID",
      "ねこ",
      "日時",
      "状態",
      "量",
      "色",
      "血液が混じっていた",
      "異物が混じっていた",
      "食欲メモ",
      "元気メモ",
      "備考",
    ],
    rows.map((record) => [
      record.id,
      record.catName,
      dateTime(record.occurredAt),
      CONSISTENCY_LABEL[record.consistency],
      record.amount,
      record.color,
      yesNo(record.hasBlood),
      yesNo(record.hasForeignObject),
      record.appetiteNote,
      record.energyNote,
      record.memo,
    ]),
    { paths: mediaPaths, recordIds: rows.map(({ id }) => id) },
  );
}

export function weightCsvFile(rows: (WeightRecord & WithCatName)[]): CsvFile {
  return {
    fileName: `${RECORD_EXPORT_FILE_BASE_NAMES.weight}.csv`,
    columns: [
      "ID",
      "ねこ",
      "日時",
      "入力方法",
      "ねこの体重（kg）",
      "人間を含んだ体重（kg）",
      "人間だけの体重（kg）",
      "BCS",
      "備考",
    ],
    rows: rows.map((record) => [
      record.id,
      record.catName,
      dateTime(record.occurredAt),
      INPUT_METHOD_LABEL[record.inputMethod],
      record.catWeightKg,
      record.combinedWeightKg,
      record.humanWeightKg,
      isBodyConditionScore(record.bcs)
        ? `${record.bcs}（${BCS_LABEL[record.bcs]}）`
        : null,
      record.memo,
    ]),
  };
}

export function vomitCsvFile(
  rows: (VomitRecord & WithCatName)[],
  mediaPaths: ExportMediaPaths | undefined,
): CsvFile {
  return csvFile(
    RECORD_EXPORT_FILE_BASE_NAMES.vomit,
    [
      "ID",
      "ねこ",
      "日時",
      "量",
      "色",
      "血液が混じっていた",
      "異物が混じっていた",
      "食欲メモ",
      "元気メモ",
      "備考",
    ],
    rows.map((record) => [
      record.id,
      record.catName,
      dateTime(record.occurredAt),
      record.amount,
      record.color,
      yesNo(record.hasBlood),
      yesNo(record.hasForeignObject),
      record.appetiteNote,
      record.energyNote,
      record.memo,
    ]),
    { paths: mediaPaths, recordIds: rows.map(({ id }) => id) },
  );
}

export function waterCsvFile(rows: (WaterRecord & WithCatName)[]): CsvFile {
  return {
    fileName: `${RECORD_EXPORT_FILE_BASE_NAMES.water}.csv`,
    columns: [
      "ID",
      "ねこ",
      "日時",
      "測定方法",
      "給水量（ml）",
      "残量（ml）",
      "推定飲水量（ml）",
      "こぼれがあった",
      "水を交換した",
      "主観評価",
      "備考",
    ],
    rows: rows.map((record) => [
      record.id,
      record.catName,
      dateTime(record.occurredAt),
      MEASUREMENT_METHOD_LABEL[record.measurementMethod],
      record.suppliedAmountMl,
      record.remainingAmountMl,
      record.estimatedIntakeMl,
      yesNo(record.hasSpill),
      yesNo(record.wasWaterChanged),
      record.subjectiveAmount
        ? SUBJECTIVE_AMOUNT_LABEL[record.subjectiveAmount]
        : null,
      record.memo,
    ]),
  };
}

export function shampooCsvFile(rows: (ShampooRecord & WithCatName)[]): CsvFile {
  return {
    fileName: `${RECORD_EXPORT_FILE_BASE_NAMES.shampoo}.csv`,
    columns: ["ID", "ねこ", "日時", "備考"],
    rows: rows.map((record) => [
      record.id,
      record.catName,
      dateTime(record.performedAt),
      record.memo,
    ]),
  };
}

export function brushingCsvFile(
  rows: (BrushingRecord & WithCatName)[],
): CsvFile {
  return {
    fileName: `${RECORD_EXPORT_FILE_BASE_NAMES.brushing}.csv`,
    columns: [
      "ID",
      "ねこ",
      "日時",
      "時間（分）",
      "抜け毛の量",
      "毛玉・もつれがあった",
      "皮膚の異常があった",
      "備考",
    ],
    rows: rows.map((record) => [
      record.id,
      record.catName,
      dateTime(record.performedAt),
      record.durationMinutes,
      record.shedAmount ? SHED_AMOUNT_LABEL[record.shedAmount] : null,
      yesNo(record.hasMats),
      yesNo(record.hasSkinIssue),
      record.memo,
    ]),
  };
}

export function cleaningCsvFile(
  rows: (CleaningRecord & WithCatName & { targetName: string })[],
): CsvFile {
  return {
    fileName: `${RECORD_EXPORT_FILE_BASE_NAMES.cleaning}.csv`,
    columns: ["ID", "ねこ", "日時", "掃除対象", "備考"],
    rows: rows.map((record) => [
      record.id,
      record.catName,
      dateTime(record.performedAt),
      record.targetName,
      record.memo,
    ]),
  };
}

export function symptomCsvFile(
  rows: (Symptom & WithCatName)[],
  mediaPaths: ExportMediaPaths | undefined,
): CsvFile {
  return csvFile(
    RECORD_EXPORT_FILE_BASE_NAMES.symptom,
    [
      "ID",
      "ねこ",
      "発症日時",
      "症状の種類",
      "回数・程度",
      "食欲メモ",
      "元気メモ",
      "状態",
      "関連する通院記録の ID",
      "備考",
    ],
    rows.map((record) => [
      record.id,
      record.catName,
      dateTime(record.onsetAt),
      record.symptomType,
      record.frequencyOrSeverity,
      record.appetiteNote,
      record.energyNote,
      SYMPTOM_STATUS_LABEL[record.status],
      record.hospitalVisitId,
      record.memo,
    ]),
    { paths: mediaPaths, recordIds: rows.map(({ id }) => id) },
  );
}

/** 服薬記録。服薬予定と、投薬の記録を別の CSV にする */
export function medicationCsvFiles(
  medications: (Medication & WithCatName)[],
  doses: (MedicationDose & WithCatName & { medicationName: string })[],
  mediaPaths: ExportMediaPaths | undefined,
): CsvFile[] {
  return [
    csvFile(
      RECORD_EXPORT_FILE_BASE_NAMES.medication,
      [
        "ID",
        "ねこ",
        "薬名",
        "1回量",
        "1日あたりの回数",
        "服用開始日",
        "終了予定日",
        "関連する症状の ID",
        "処方元の通院記録の ID",
        "服薬歴に移した日時",
      ],
      medications.map((medication) => [
        medication.id,
        medication.catName,
        medication.name,
        medication.doseAmount,
        medication.dosesPerDay,
        medication.startDate,
        medication.endDate,
        medication.symptomId,
        medication.hospitalVisitId,
        timestampJst(medication.archivedAt),
      ]),
      { paths: mediaPaths, recordIds: medications.map(({ id }) => id) },
    ),
    {
      fileName: `${MEDICATION_DOSE_FILE_BASE_NAME}.csv`,
      columns: [
        "ID",
        "ねこ",
        "服薬予定の ID",
        "薬名",
        "日時",
        "投薬できた",
        "備考",
      ],
      rows: doses.map((dose) => [
        dose.id,
        dose.catName,
        dose.medicationId,
        dose.medicationName,
        dateTime(dose.occurredAt),
        yesNo(dose.wasAdministered),
        dose.memo,
      ]),
    },
  ];
}

export function hospitalVisitCsvFile(
  rows: (HospitalVisit & WithCatName)[],
  mediaPaths: ExportMediaPaths | undefined,
): CsvFile {
  return csvFile(
    RECORD_EXPORT_FILE_BASE_NAMES.hospitalVisit,
    [
      "ID",
      "ねこ",
      "受診日時",
      "受診理由",
      "診断・所見",
      "検査と結果",
      "注射・処置",
      "次回受診予定日時",
      "関連する症状の ID",
      "備考",
    ],
    rows.map((record) => [
      record.id,
      record.catName,
      dateTime(record.visitedAt),
      record.reason,
      record.diagnosis,
      record.examinationResults,
      record.treatment,
      dateTime(record.nextVisitAt),
      record.symptomId,
      record.memo,
    ]),
    { paths: mediaPaths, recordIds: rows.map(({ id }) => id) },
  );
}

/** 支出記録。猫ではなく家に属するため、関連するねこは名前を「、」でつなぐ */
export function expenseCsvFile(
  rows: (ExpenseRecord & {
    catNames: string[];
    hospitalVisitIds: string[];
  })[],
  mediaPaths: ExportMediaPaths | undefined,
): CsvFile {
  return csvFile(
    RECORD_EXPORT_FILE_BASE_NAMES.expense,
    [
      "ID",
      "支出日",
      "カテゴリ",
      "金額（円）",
      "関連するねこ",
      "病院代として紐付けた通院記録の ID",
      "メモ",
    ],
    rows.map((record) => [
      record.id,
      formatDateTimeUtc(record.spentAt).slice(0, 10),
      EXPENSE_CATEGORY_LABEL[record.category],
      record.amountYen,
      record.catNames.join("、"),
      record.hospitalVisitIds.join("\n"),
      record.memo,
    ]),
    { paths: mediaPaths, recordIds: rows.map(({ id }) => id) },
  );
}

/** メモ。日付を残さないメモは日時を空にする */
export function memoCsvFile(
  rows: (MemoRecord & WithCatName)[],
  mediaPaths: ExportMediaPaths | undefined,
): CsvFile {
  return csvFile(
    RECORD_EXPORT_FILE_BASE_NAMES.memo,
    ["ID", "ねこ", "日時", "メモ"],
    rows.map((record) => [
      record.id,
      record.catName,
      dateTime(record.recordedAt),
      record.content,
    ]),
    { paths: mediaPaths, recordIds: rows.map(({ id }) => id) },
  );
}
