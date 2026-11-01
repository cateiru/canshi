import type { McpServer } from "@modelcontextprotocol/server";
import { and, asc, eq } from "drizzle-orm";
import { type ZodRawShape, z } from "zod";
import { getDb } from "@/db/client";
import {
  BRUSHING_SHED_AMOUNTS,
  brushingRecords,
  cleaningRecords,
  EXPENSE_CATEGORIES,
  expenseRecordCats,
  expenseRecordHospitalVisits,
  expenseRecords,
  feedingRecordItems,
  feedingRecords,
  GIVEN_AMOUNT_LEVELS,
  hospitalVisits,
  LEFTOVER_LEVELS,
  medicationDoses,
  memoRecords,
  poopRecords,
  shampooRecords,
  symptoms,
  vomitRecords,
  waterRecords,
  weightRecords,
} from "@/db/schema";
import {
  createBrushingRecord,
  updateBrushingRecord,
} from "@/features/brushing-records/mutations";
import {
  BRUSHING_DURATION_MAX_MINUTES,
  brushingRecordFormSchema,
} from "@/features/brushing-records/schema";
import {
  createCleaningRecord,
  updateCleaningRecord,
} from "@/features/cleaning/recordMutations";
import { cleaningRecordFormSchema } from "@/features/cleaning/recordSchema";
import { listCleaningTargets } from "@/features/cleaning/targetQueries";
import { createExpense, updateExpense } from "@/features/expenses/mutations";
import { expenseFormSchema } from "@/features/expenses/schema";
import {
  createFeedingRecord,
  updateFeedingRecord,
} from "@/features/feeding-records/mutations";
import { feedingRecordFormSchema } from "@/features/feeding-records/schema";
import {
  createHospitalVisit,
  updateHospitalVisit,
} from "@/features/hospital-visits/mutations";
import { hospitalVisitFormSchema } from "@/features/hospital-visits/schema";
import { getCatForUser, listCatsForUser } from "@/features/households/queries";
import {
  createMedicationDose,
  updateMedicationDose,
} from "@/features/medications/doseMutations";
import { medicationDoseFormSchema } from "@/features/medications/doseSchema";
import { listMedications } from "@/features/medications/queries";
import {
  createMemoRecord,
  updateMemoRecord,
} from "@/features/memo-records/mutations";
import { listMemoRecords } from "@/features/memo-records/queries";
import {
  MEMO_CONTENT_MAX_LENGTH,
  memoRecordFormSchema,
} from "@/features/memo-records/schema";
import {
  createPoopRecord,
  updatePoopRecord,
} from "@/features/poop-records/mutations";
import { poopRecordFormSchema } from "@/features/poop-records/schema";
import {
  createShampooRecord,
  updateShampooRecord,
} from "@/features/shampoo-records/mutations";
import { shampooRecordFormSchema } from "@/features/shampoo-records/schema";
import { splitDateTimeUtc } from "@/features/shared/datetime";
import { paginate } from "@/features/shared/pagination";
import { createSymptom, updateSymptom } from "@/features/symptoms/mutations";
import { symptomFormSchema } from "@/features/symptoms/schema";
import {
  createVomitRecord,
  updateVomitRecord,
} from "@/features/vomit-records/mutations";
import { vomitRecordFormSchema } from "@/features/vomit-records/schema";
import {
  createWaterRecord,
  updateWaterRecord,
} from "@/features/water-records/mutations";
import { waterRecordFormSchema } from "@/features/water-records/schema";
import {
  createWeightRecord,
  updateWeightRecord,
} from "@/features/weight-records/mutations";
import { weightRecordFormSchema } from "@/features/weight-records/schema";
import {
  dateTimeValues,
  type FormValues,
  mergeFormValues,
  nowDateTimeValues,
  parseFormValues,
  toCheckboxValue,
  toOptionalValue,
} from "../formValues";
import {
  allowedMcpRecordTypes,
  isCatAllowedForMcp,
  type McpPermissionRecordType,
  type McpPermissions,
  writableMcpRecordTypes,
} from "../permissionRules";
import { getMcpPermissions } from "../permissions";
import {
  catNotFoundMessage,
  errorResult,
  jsonResult,
  type McpConnection,
  type McpToolContext,
  resolveWritableCat,
} from "./context";

type Db = ReturnType<typeof getDb>;

/** 書き込む猫。ユーザーが参照でき、この接続からの読み取りも許可している */
type WritableCat = { id: string; householdId: string };

type SaveResult = { id: string } | { error: string };

/**
 * 記録の種類ごとの、追加・編集ツールの定義。引数はフォームの項目名に揃え、
 * フォームの値に直してから画面と同じ zod スキーマで検証する（`../formValues.ts`）
 */
type RecordToolDefinition<TData, TExisting> = {
  recordType: McpPermissionRecordType;
  /** ツール名の一部（`create_{name}`・`update_{name}`） */
  name: string;
  /** 「うんちの記録」のような、記録の名前 */
  label: string;
  /** 項目の説明など、ツールの説明に添える文 */
  description: string;
  /** 引数（`catId`・`id` を除く）。追加と編集で共通にするため、すべて省略できる形にする */
  fields: ZodRawShape;
  /** フォームの値に含めない引数（掃除対象の ID など） */
  nonFormKeys?: string[];
  schema: z.ZodType<TData>;
  /** 追加するときの既定値。日時の項目は現在時刻にする */
  defaults(): FormValues;
  /** 猫の記録を読み、フォームの値にする。見つからなければ null */
  load(
    db: Db,
    catId: string,
    id: string,
  ): Promise<{ values: FormValues; existing: TExisting } | null>;
  /** 検証の前に、引数に合わせてフォームの値を整える */
  adjust?(values: FormValues, args: Record<string, unknown>): FormValues;
  create(input: {
    ctx: McpToolContext;
    connection: McpConnection;
    permissions: McpPermissions;
    cat: WritableCat;
    data: TData;
    args: Record<string, unknown>;
  }): Promise<SaveResult>;
  update(input: {
    ctx: McpToolContext;
    connection: McpConnection;
    permissions: McpPermissions;
    cat: WritableCat;
    id: string;
    data: TData;
    existing: TExisting;
    args: Record<string, unknown>;
  }): Promise<SaveResult>;
};

function defineRecordTool<TData, TExisting>(
  definition: RecordToolDefinition<TData, TExisting>,
) {
  return definition;
}

/** 記録の日付の引数 */
function dateField(label: string) {
  return z
    .string()
    .optional()
    .describe(`${label}（YYYY-MM-DD、日本時間）。追加で省略すると今日`);
}

/** 記録の時刻の引数 */
function timeField(label: string) {
  return z
    .string()
    .optional()
    .describe(
      `${label}（HH:mm、日本時間の 24 時間表記）。追加で省略すると今の時刻`,
    );
}

/** 任意の文字列の引数。null で空にできる */
function optionalText(label: string, maxLength: number) {
  return z
    .string()
    .nullable()
    .optional()
    .describe(`${label}（${maxLength}文字以内）。null を指定すると空にする`);
}

const RECORD_NOT_FOUND_ERROR = "記録が見つかりませんでした";

const COMMON_DESCRIPTION =
  "日時は日本時間で指定する。" +
  "編集では指定した項目だけを変更し、省略した項目は今の値のまま。";

const poopRecordTool = defineRecordTool({
  recordType: "poop",
  name: "poop_record",
  label: "うんちの記録",
  description:
    "consistency（状態）は追加では必須で、hard=硬い、normal=普通、soft=柔らかい、liquid=水様。",
  fields: {
    occurredDate: dateField("記録日"),
    occurredTime: timeField("記録時刻"),
    amount: optionalText("量", 50),
    color: optionalText("色", 50),
    consistency: z.enum(["hard", "normal", "soft", "liquid"]).optional(),
    hasBlood: z.boolean().optional().describe("血が混じっているか"),
    hasForeignObject: z.boolean().optional().describe("異物が混じっているか"),
    appetiteNote: optionalText("食欲メモ", 200),
    energyNote: optionalText("元気メモ", 200),
    memo: optionalText("備考", 500),
  },
  schema: poopRecordFormSchema,
  defaults: () => nowDateTimeValues("occurredDate", "occurredTime"),
  async load(db, catId, id) {
    const [row] = await db
      .select()
      .from(poopRecords)
      .where(and(eq(poopRecords.id, id), eq(poopRecords.catId, catId)))
      .limit(1);
    if (!row) return null;
    return {
      existing: null,
      values: {
        ...dateTimeValues("occurredDate", "occurredTime", row.occurredAt),
        amount: toOptionalValue(row.amount),
        color: toOptionalValue(row.color),
        consistency: row.consistency,
        hasBlood: toCheckboxValue(row.hasBlood),
        hasForeignObject: toCheckboxValue(row.hasForeignObject),
        appetiteNote: toOptionalValue(row.appetiteNote),
        energyNote: toOptionalValue(row.energyNote),
        memo: toOptionalValue(row.memo),
      },
    };
  },
  create: async ({ ctx, cat, data }) => ({
    id: await createPoopRecord(cat.id, data, ctx.env.DB),
  }),
  update: async ({ ctx, cat, id, data }) =>
    (await updatePoopRecord(cat.id, id, data, ctx.env.DB))
      ? { id }
      : { error: RECORD_NOT_FOUND_ERROR },
});

const vomitRecordTool = defineRecordTool({
  recordType: "vomit",
  name: "vomit_record",
  label: "嘔吐の記録",
  description: "",
  fields: {
    occurredDate: dateField("記録日"),
    occurredTime: timeField("記録時刻"),
    amount: optionalText("量", 50),
    color: optionalText("色", 50),
    hasBlood: z.boolean().optional().describe("血が混じっているか"),
    hasForeignObject: z.boolean().optional().describe("異物が混じっているか"),
    appetiteNote: optionalText("食欲メモ", 200),
    energyNote: optionalText("元気メモ", 200),
    memo: optionalText("備考", 500),
  },
  schema: vomitRecordFormSchema,
  defaults: () => nowDateTimeValues("occurredDate", "occurredTime"),
  async load(db, catId, id) {
    const [row] = await db
      .select()
      .from(vomitRecords)
      .where(and(eq(vomitRecords.id, id), eq(vomitRecords.catId, catId)))
      .limit(1);
    if (!row) return null;
    return {
      existing: null,
      values: {
        ...dateTimeValues("occurredDate", "occurredTime", row.occurredAt),
        amount: toOptionalValue(row.amount),
        color: toOptionalValue(row.color),
        hasBlood: toCheckboxValue(row.hasBlood),
        hasForeignObject: toCheckboxValue(row.hasForeignObject),
        appetiteNote: toOptionalValue(row.appetiteNote),
        energyNote: toOptionalValue(row.energyNote),
        memo: toOptionalValue(row.memo),
      },
    };
  },
  create: async ({ ctx, cat, data }) => ({
    id: await createVomitRecord(cat.id, data, ctx.env.DB),
  }),
  update: async ({ ctx, cat, id, data }) =>
    (await updateVomitRecord(cat.id, id, data, ctx.env.DB))
      ? { id }
      : { error: RECORD_NOT_FOUND_ERROR },
});

const waterRecordTool = defineRecordTool({
  recordType: "water",
  name: "water_record",
  label: "飲水の記録",
  description:
    "measurementMethod（測定方法）と suppliedAmountMl（給水量）は追加では必須。" +
    "measurementMethod は measuring_cup=計量カップ、scale=はかり、visual=目分量。" +
    "subjectiveAmount（主観評価）は more=多い、usual=いつもどおり、less=少ない。",
  fields: {
    occurredDate: dateField("記録日"),
    occurredTime: timeField("記録時刻"),
    measurementMethod: z.enum(["measuring_cup", "scale", "visual"]).optional(),
    suppliedAmountMl: z.number().optional().describe("給水量（ml）"),
    remainingAmountMl: z
      .number()
      .nullable()
      .optional()
      .describe("残量（ml）。null を指定すると空にする"),
    hasSpill: z.boolean().optional().describe("こぼしたか"),
    wasWaterChanged: z.boolean().optional().describe("水を替えたか"),
    subjectiveAmount: z.enum(["more", "usual", "less"]).nullable().optional(),
    memo: optionalText("備考", 500),
  },
  schema: waterRecordFormSchema,
  defaults: () => nowDateTimeValues("occurredDate", "occurredTime"),
  async load(db, catId, id) {
    const [row] = await db
      .select()
      .from(waterRecords)
      .where(and(eq(waterRecords.id, id), eq(waterRecords.catId, catId)))
      .limit(1);
    if (!row) return null;
    return {
      existing: null,
      values: {
        ...dateTimeValues("occurredDate", "occurredTime", row.occurredAt),
        measurementMethod: row.measurementMethod,
        suppliedAmountMl: row.suppliedAmountMl,
        remainingAmountMl: toOptionalValue(row.remainingAmountMl),
        hasSpill: toCheckboxValue(row.hasSpill),
        wasWaterChanged: toCheckboxValue(row.wasWaterChanged),
        subjectiveAmount: toOptionalValue(row.subjectiveAmount),
        memo: toOptionalValue(row.memo),
      },
    };
  },
  create: async ({ ctx, cat, data }) => ({
    id: await createWaterRecord(cat.id, data, ctx.env.DB),
  }),
  update: async ({ ctx, cat, id, data }) =>
    (await updateWaterRecord(cat.id, id, data, ctx.env.DB))
      ? { id }
      : { error: RECORD_NOT_FOUND_ERROR },
});

const weightRecordTool = defineRecordTool({
  recordType: "weight",
  name: "weight_record",
  label: "体重の記録",
  description:
    "猫の体重は catWeightKg（kg）で指定する（inputMethod=direct）。" +
    "人間が猫を抱えて量った場合は inputMethod=auto にして combinedWeightKg（人間を含んだ体重）と" +
    "humanWeightKg（人間だけの体重）を指定すると、差を猫の体重にする。" +
    "catWeightKg だけを指定したときは inputMethod=direct として扱う。" +
    "bcs はボディコンディションスコア（1〜5。1=痩せ、2=やや痩せ、3=理想体重、4=やや肥満、5=肥満）。",
  fields: {
    occurredDate: dateField("記録日"),
    occurredTime: timeField("記録時刻"),
    inputMethod: z.enum(["auto", "direct"]).optional(),
    catWeightKg: z.number().optional().describe("猫の体重（kg）"),
    combinedWeightKg: z.number().optional().describe("人間を含んだ体重（kg）"),
    humanWeightKg: z.number().optional().describe("人間だけの体重（kg）"),
    bcs: z
      .number()
      .int()
      .nullable()
      .optional()
      .describe("BCS（1〜5）。null を指定すると未評価にする"),
  },
  schema: weightRecordFormSchema,
  defaults: () => ({
    ...nowDateTimeValues("occurredDate", "occurredTime"),
    inputMethod: "direct",
  }),
  async load(db, catId, id) {
    const [row] = await db
      .select()
      .from(weightRecords)
      .where(and(eq(weightRecords.id, id), eq(weightRecords.catId, catId)))
      .limit(1);
    if (!row) return null;
    return {
      existing: null,
      values: {
        ...dateTimeValues("occurredDate", "occurredTime", row.occurredAt),
        inputMethod: row.inputMethod,
        combinedWeightKg: toOptionalValue(row.combinedWeightKg),
        humanWeightKg: toOptionalValue(row.humanWeightKg),
        catWeightKg: toOptionalValue(row.catWeightKg),
        bcs: toOptionalValue(row.bcs),
      },
    };
  },
  adjust(values, args) {
    // 猫の体重だけを指定したときは、そのまま猫の体重として記録する。人間を含んだ体重などは
    // 猫の体重と合わなくなるため、指定されていなければ空にする
    if (args.catWeightKg !== undefined && args.inputMethod === undefined) {
      return {
        ...values,
        inputMethod: "direct",
        combinedWeightKg:
          args.combinedWeightKg === undefined ? "" : values.combinedWeightKg,
        humanWeightKg:
          args.humanWeightKg === undefined ? "" : values.humanWeightKg,
      };
    }
    return values;
  },
  create: async ({ ctx, cat, data }) => ({
    id: await createWeightRecord(cat.id, data, ctx.env.DB),
  }),
  update: async ({ ctx, cat, id, data }) =>
    (await updateWeightRecord(cat.id, id, data, ctx.env.DB))
      ? { id }
      : { error: RECORD_NOT_FOUND_ERROR },
});

const shampooRecordTool = defineRecordTool({
  recordType: "shampoo",
  name: "shampoo_record",
  label: "シャンプーの記録",
  description: "",
  fields: {
    performedDate: dateField("実施日"),
    performedTime: timeField("実施時刻"),
    memo: optionalText("備考", 500),
  },
  schema: shampooRecordFormSchema,
  defaults: () => nowDateTimeValues("performedDate", "performedTime"),
  async load(db, catId, id) {
    const [row] = await db
      .select()
      .from(shampooRecords)
      .where(and(eq(shampooRecords.id, id), eq(shampooRecords.catId, catId)))
      .limit(1);
    if (!row) return null;
    return {
      existing: null,
      values: {
        ...dateTimeValues("performedDate", "performedTime", row.performedAt),
        memo: toOptionalValue(row.memo),
      },
    };
  },
  create: async ({ ctx, cat, data }) => ({
    id: await createShampooRecord(cat.id, data, ctx.env.DB),
  }),
  update: async ({ ctx, cat, id, data }) =>
    (await updateShampooRecord(cat.id, id, data, ctx.env.DB))
      ? { id }
      : { error: RECORD_NOT_FOUND_ERROR },
});

const brushingRecordTool = defineRecordTool({
  recordType: "brushing",
  name: "brushing_record",
  label: "ブラッシングの記録",
  description:
    "shedAmount（抜け毛の量）は less=少ない、usual=いつも通り、more=多い。",
  fields: {
    performedDate: dateField("実施日"),
    performedTime: timeField("実施時刻"),
    durationMinutes: z
      .number()
      .int()
      .nullable()
      .optional()
      .describe(
        `ブラッシングにかけた時間（分、1〜${BRUSHING_DURATION_MAX_MINUTES}）。null を指定すると空にする`,
      ),
    shedAmount: z
      .enum(BRUSHING_SHED_AMOUNTS)
      .nullable()
      .optional()
      .describe("抜け毛の量。null を指定すると未選択にする"),
    hasMats: z.boolean().optional().describe("毛玉・もつれがあったか"),
    hasSkinIssue: z
      .boolean()
      .optional()
      .describe("皮膚の異常（赤み・フケ・かさぶたなど）があったか"),
    memo: optionalText("備考", 500),
  },
  schema: brushingRecordFormSchema,
  defaults: () => nowDateTimeValues("performedDate", "performedTime"),
  async load(db, catId, id) {
    const [row] = await db
      .select()
      .from(brushingRecords)
      .where(and(eq(brushingRecords.id, id), eq(brushingRecords.catId, catId)))
      .limit(1);
    if (!row) return null;
    return {
      existing: null,
      values: {
        ...dateTimeValues("performedDate", "performedTime", row.performedAt),
        durationMinutes: toOptionalValue(row.durationMinutes),
        shedAmount: toOptionalValue(row.shedAmount),
        hasMats: toCheckboxValue(row.hasMats),
        hasSkinIssue: toCheckboxValue(row.hasSkinIssue),
        memo: toOptionalValue(row.memo),
      },
    };
  },
  create: async ({ ctx, cat, data }) => ({
    id: await createBrushingRecord(cat.id, data, ctx.env.DB),
  }),
  update: async ({ ctx, cat, id, data }) =>
    (await updateBrushingRecord(cat.id, id, data, ctx.env.DB))
      ? { id }
      : { error: RECORD_NOT_FOUND_ERROR },
});

const cleaningRecordTool = defineRecordTool({
  recordType: "cleaning",
  name: "cleaning_record",
  label: "掃除の記録",
  description:
    "追加では cleaningTargetId（掃除対象の ID。list_cleaning_targets で取得できる）が必須。" +
    "掃除対象は編集では変えられない。",
  fields: {
    cleaningTargetId: z
      .string()
      .optional()
      .describe("掃除対象の ID（追加では必須）"),
    performedDate: dateField("実施日"),
    performedTime: timeField("実施時刻"),
    memo: optionalText("備考", 500),
  },
  nonFormKeys: ["cleaningTargetId"],
  schema: cleaningRecordFormSchema,
  defaults: () => nowDateTimeValues("performedDate", "performedTime"),
  async load(db, catId, id) {
    const [row] = await db
      .select()
      .from(cleaningRecords)
      .where(and(eq(cleaningRecords.id, id), eq(cleaningRecords.catId, catId)))
      .limit(1);
    if (!row) return null;
    return {
      existing: { cleaningTargetId: row.cleaningTargetId },
      values: {
        ...dateTimeValues("performedDate", "performedTime", row.performedAt),
        memo: toOptionalValue(row.memo),
      },
    };
  },
  async create({ ctx, cat, data, args }) {
    if (typeof args.cleaningTargetId !== "string") {
      return { error: "cleaningTargetId を指定してください" };
    }
    const id = await createCleaningRecord(
      cat.id,
      args.cleaningTargetId,
      data,
      ctx.env.DB,
    );
    return id
      ? { id }
      : {
          error:
            "掃除対象が見つかりませんでした。list_cleaning_targets で有効な掃除対象を確かめてください",
        };
  },
  update: async ({ ctx, cat, id, data, existing }) =>
    (await updateCleaningRecord(
      cat.id,
      existing.cleaningTargetId,
      id,
      data,
      ctx.env.DB,
    ))
      ? { id }
      : { error: RECORD_NOT_FOUND_ERROR },
});

const medicationDoseTool = defineRecordTool({
  recordType: "medicationDose",
  name: "medication_dose",
  label: "投薬の記録",
  description:
    "追加では medicationId（服薬予定の ID。list_medications で取得できる）が必須。" +
    "服薬予定は編集では変えられない。wasAdministered は投薬できたか" +
    "（追加で省略すると、画面と同じく true）。",
  fields: {
    medicationId: z
      .string()
      .optional()
      .describe("服薬予定の ID（追加では必須）"),
    occurredDate: dateField("投薬日"),
    occurredTime: timeField("投薬時刻"),
    wasAdministered: z.boolean().optional().describe("投薬できたか"),
    memo: optionalText("備考", 500),
  },
  nonFormKeys: ["medicationId"],
  schema: medicationDoseFormSchema,
  defaults: () => ({
    ...nowDateTimeValues("occurredDate", "occurredTime"),
    // 画面のフォームと同じく、投薬できた状態から始める
    wasAdministered: "on",
  }),
  async load(db, catId, id) {
    const [row] = await db
      .select()
      .from(medicationDoses)
      .where(and(eq(medicationDoses.id, id), eq(medicationDoses.catId, catId)))
      .limit(1);
    if (!row) return null;
    return {
      existing: { medicationId: row.medicationId },
      values: {
        ...dateTimeValues("occurredDate", "occurredTime", row.occurredAt),
        wasAdministered: toCheckboxValue(row.wasAdministered),
        memo: toOptionalValue(row.memo),
      },
    };
  },
  async create({ ctx, cat, data, args }) {
    if (typeof args.medicationId !== "string") {
      return { error: "medicationId を指定してください" };
    }
    const id = await createMedicationDose(
      cat.id,
      args.medicationId,
      data,
      ctx.env.DB,
    );
    return id
      ? { id }
      : {
          error:
            "服薬予定が見つかりませんでした。list_medications で服薬予定を確かめてください",
        };
  },
  update: async ({ ctx, cat, id, data, existing }) =>
    (await updateMedicationDose(
      cat.id,
      existing.medicationId,
      id,
      data,
      ctx.env.DB,
    ))
      ? { id }
      : { error: RECORD_NOT_FOUND_ERROR },
});

const symptomTool = defineRecordTool({
  recordType: "symptom",
  name: "symptom",
  label: "症状の記録",
  description:
    "symptomType（症状の種類）と status（状態）は追加では必須。" +
    "status は ongoing=続いている、improving=良くなっている、resolved=治った。" +
    "hospitalVisitId には同じ猫の通院記録の ID を指定できる。",
  fields: {
    symptomType: z.string().optional().describe("症状の種類（100文字以内）"),
    onsetDate: dateField("発症日"),
    onsetTime: timeField("発症時刻"),
    frequencyOrSeverity: optionalText("回数・程度", 100),
    appetiteNote: optionalText("食欲メモ", 200),
    energyNote: optionalText("元気メモ", 200),
    status: z.enum(["ongoing", "improving", "resolved"]).optional(),
    hospitalVisitId: z
      .string()
      .nullable()
      .optional()
      .describe("関連する通院記録の ID。null を指定すると紐付けを外す"),
    memo: optionalText("備考", 500),
  },
  schema: symptomFormSchema,
  defaults: () => nowDateTimeValues("onsetDate", "onsetTime"),
  async load(db, catId, id) {
    const [row] = await db
      .select()
      .from(symptoms)
      .where(and(eq(symptoms.id, id), eq(symptoms.catId, catId)))
      .limit(1);
    if (!row) return null;
    return {
      existing: null,
      values: {
        symptomType: row.symptomType,
        ...dateTimeValues("onsetDate", "onsetTime", row.onsetAt),
        frequencyOrSeverity: toOptionalValue(row.frequencyOrSeverity),
        appetiteNote: toOptionalValue(row.appetiteNote),
        energyNote: toOptionalValue(row.energyNote),
        status: row.status,
        hospitalVisitId: toOptionalValue(row.hospitalVisitId),
        memo: toOptionalValue(row.memo),
      },
    };
  },
  create: ({ ctx, cat, data }) => createSymptom(cat.id, data, ctx.env.DB),
  update: ({ ctx, cat, id, data }) =>
    updateSymptom(cat.id, id, data, ctx.env.DB),
});

const hospitalVisitTool = defineRecordTool({
  recordType: "hospitalVisit",
  name: "hospital_visit",
  label: "通院の記録",
  description:
    "reason（受診理由）は追加では必須。symptomId には同じ猫の症状の記録の ID を指定できる。" +
    "次回の受診予定は nextVisitDate と nextVisitTime の両方を指定するか、両方を null にする。" +
    "病院代（支出の記録）はこのツールでは扱わず、編集しても紐付いている支出の記録はそのまま残る。",
  fields: {
    visitedDate: dateField("受診日"),
    visitedTime: timeField("受診時刻"),
    reason: z.string().optional().describe("受診理由（200文字以内）"),
    symptomId: z
      .string()
      .nullable()
      .optional()
      .describe("関連する症状の記録の ID。null を指定すると紐付けを外す"),
    diagnosis: optionalText("診断・所見", 500),
    examinationResults: optionalText("検査と結果", 500),
    treatment: optionalText("注射・処置", 500),
    nextVisitDate: z
      .string()
      .nullable()
      .optional()
      .describe("次回受診予定日（YYYY-MM-DD）。null を指定すると空にする"),
    nextVisitTime: z
      .string()
      .nullable()
      .optional()
      .describe("次回受診予定時刻（HH:mm）。null を指定すると空にする"),
    memo: optionalText("備考", 500),
  },
  schema: hospitalVisitFormSchema,
  defaults: () => nowDateTimeValues("visitedDate", "visitedTime"),
  async load(db, catId, id) {
    const [row] = await db
      .select({
        visit: hospitalVisits,
        expenseAmountYen: expenseRecords.amountYen,
      })
      .from(hospitalVisits)
      .leftJoin(
        expenseRecordHospitalVisits,
        eq(expenseRecordHospitalVisits.hospitalVisitId, hospitalVisits.id),
      )
      .leftJoin(
        expenseRecords,
        eq(expenseRecords.id, expenseRecordHospitalVisits.expenseRecordId),
      )
      .where(and(eq(hospitalVisits.id, id), eq(hospitalVisits.catId, catId)))
      .limit(1);
    if (!row) return null;
    const { visit } = row;
    const nextVisit = visit.nextVisitAt
      ? splitDateTimeUtc(visit.nextVisitAt)
      : null;
    return {
      existing: null,
      values: {
        ...dateTimeValues("visitedDate", "visitedTime", visit.visitedAt),
        reason: visit.reason,
        symptomId: toOptionalValue(visit.symptomId),
        diagnosis: toOptionalValue(visit.diagnosis),
        examinationResults: toOptionalValue(visit.examinationResults),
        treatment: toOptionalValue(visit.treatment),
        nextVisitDate: nextVisit?.date ?? "",
        nextVisitTime: nextVisit?.time ?? "",
        memo: toOptionalValue(visit.memo),
        // 病院代は画面の編集と同じく今の金額を送り、支出の記録を消さずに残す
        expenseAmountYen: toOptionalValue(row.expenseAmountYen),
      },
    };
  },
  create: ({ ctx, cat, data }) => createHospitalVisit(cat, data, ctx.env.DB),
  update: ({ ctx, cat, id, data }) =>
    updateHospitalVisit(cat, id, data, ctx.env.DB),
});

const memoTool = defineRecordTool({
  recordType: "memo",
  name: "memo",
  label: "メモ",
  description:
    "content（本文）は追加では必須。" +
    "hasDate を false にすると日付を残さないメモになり、タイムライン（list_timeline）には載らない" +
    "（list_memos では読める）。追加で hasDate を省略すると日付を残す。" +
    "日付を残さないメモの編集で recordedDate・recordedTime を指定すると、日付を残すメモにする" +
    "（片方だけを指定したときは、もう片方を今の日時にする）。" +
    "メモの ID は list_memos でも取得できる。",
  fields: {
    content: z
      .string()
      .optional()
      .describe(`メモの本文（${MEMO_CONTENT_MAX_LENGTH}文字以内）`),
    hasDate: z.boolean().optional().describe("日付を残すか"),
    recordedDate: dateField("日付"),
    recordedTime: timeField("時刻"),
  },
  schema: memoRecordFormSchema,
  defaults: () => ({
    ...nowDateTimeValues("recordedDate", "recordedTime"),
    hasDate: "on",
  }),
  async load(db, catId, id) {
    const [row] = await db
      .select()
      .from(memoRecords)
      .where(and(eq(memoRecords.id, id), eq(memoRecords.catId, catId)))
      .limit(1);
    if (!row) return null;
    return {
      existing: null,
      values: {
        hasDate: toCheckboxValue(row.recordedAt != null),
        // 日付を残さないメモに日付を残すときは、指定しなかった日付・時刻を今の日時にする
        ...(row.recordedAt
          ? dateTimeValues("recordedDate", "recordedTime", row.recordedAt)
          : nowDateTimeValues("recordedDate", "recordedTime")),
        content: row.content,
      },
    };
  },
  adjust(values, args) {
    // 日付・時刻を指定したのに hasDate を省略したときは、日付を残すメモにする
    if (
      args.hasDate === undefined &&
      (args.recordedDate !== undefined || args.recordedTime !== undefined)
    ) {
      return { ...values, hasDate: "on" };
    }
    return values;
  },
  create: async ({ ctx, cat, data }) => ({
    id: await createMemoRecord(cat.id, data, ctx.env.DB),
  }),
  update: async ({ ctx, cat, id, data }) =>
    (await updateMemoRecord(cat.id, id, data, ctx.env.DB))
      ? { id }
      : { error: RECORD_NOT_FOUND_ERROR },
});

/** 支出の記録の関連する猫のうち、この接続から支出の記録を書き込める猫だけを返す */
async function listExpenseWritableCatIds(
  ctx: McpToolContext,
  userId: string,
  householdId: string,
  permissions: McpPermissions,
) {
  const cats = await listCatsForUser(userId, ctx.env.DB);
  return cats
    .filter(
      (cat) =>
        cat.householdId === householdId &&
        isCatAllowedForMcp(permissions, cat) &&
        writableMcpRecordTypes(permissions, cat.id).includes("expense"),
    )
    .map((cat) => cat.id);
}

/**
 * AI が指定した関連する猫を確かめる。指定した猫のどれかを書き込めなければエラー。
 * 指定した猫には、記録する猫（`catId`）を必ず含める
 */
async function resolveExpenseCatIds(
  ctx: McpToolContext,
  cat: WritableCat,
  args: Record<string, unknown>,
  permissions: McpPermissions,
  userId: string,
): Promise<{ catIds: string[]; writable: string[] } | { error: string }> {
  const writable = await listExpenseWritableCatIds(
    ctx,
    userId,
    cat.householdId,
    permissions,
  );
  const requested = Array.isArray(args.catIds) ? (args.catIds as string[]) : [];
  for (const id of requested) {
    if (!writable.includes(id)) {
      return { error: catNotFoundMessage(id) };
    }
  }
  return { catIds: [...new Set([cat.id, ...requested])], writable };
}

const expenseTool = defineRecordTool({
  recordType: "expense",
  name: "expense",
  label: "支出の記録",
  description:
    "支出は catId の猫の家の支出として記録し、catId の猫を関連する猫に含める。" +
    "amountYen（金額、円）と category（カテゴリ）は追加では必須。" +
    `category は ${EXPENSE_CATEGORIES.join("・")} のいずれか。` +
    "catIds には同じ家のほかの猫も関連する猫として指定できる。" +
    "通院記録との紐付けはこのツールでは扱わず、編集しても今の紐付けのまま残る" +
    "（カテゴリを hospital 以外にすると外れる）。" +
    "編集できるのは、catId の猫を関連する猫に含む支出の記録に限る。",
  fields: {
    spentDate: z
      .string()
      .optional()
      .describe("支出日（YYYY-MM-DD、日本時間）。追加で省略すると今日"),
    amountYen: z.number().int().optional().describe("金額（円）"),
    category: z.enum(EXPENSE_CATEGORIES).optional(),
    catIds: z
      .array(z.string())
      .optional()
      .describe(
        "関連する猫の ID（catId の猫は指定しなくても含める）。編集で指定すると置き換える",
      ),
    memo: optionalText("メモ", 500),
  },
  nonFormKeys: ["catIds"],
  schema: expenseFormSchema,
  defaults: () => ({
    spentDate: nowDateTimeValues("spentDate", "spentTime").spentDate,
  }),
  async load(db, catId, id) {
    // 猫のタイムラインと同じく、その猫が関連する猫に含まれる支出の記録だけを編集できる
    const [row] = await db
      .select({ record: expenseRecords })
      .from(expenseRecords)
      .innerJoin(
        expenseRecordCats,
        eq(expenseRecordCats.expenseRecordId, expenseRecords.id),
      )
      .where(and(eq(expenseRecords.id, id), eq(expenseRecordCats.catId, catId)))
      .limit(1);
    if (!row) return null;
    const [catRows, visitRows] = await Promise.all([
      db
        .select({ catId: expenseRecordCats.catId })
        .from(expenseRecordCats)
        .where(eq(expenseRecordCats.expenseRecordId, id)),
      db
        .select({ id: expenseRecordHospitalVisits.hospitalVisitId })
        .from(expenseRecordHospitalVisits)
        .where(eq(expenseRecordHospitalVisits.expenseRecordId, id)),
    ]);
    const { record } = row;
    return {
      existing: {
        householdId: record.householdId,
        catIds: catRows.map((linked) => linked.catId),
      },
      values: {
        spentDate: splitDateTimeUtc(record.spentAt).date,
        amountYen: record.amountYen,
        category: record.category,
        memo: toOptionalValue(record.memo),
        catIds: catRows.map((linked) => linked.catId),
        hospitalVisitIds: visitRows.map((visit) => visit.id),
      },
    };
  },
  async create({ ctx, connection, permissions, cat, data, args }) {
    const resolved = await resolveExpenseCatIds(
      ctx,
      cat,
      args,
      permissions,
      connection.userId,
    );
    if ("error" in resolved) return resolved;
    const saved = await createExpense(
      cat.householdId,
      { ...data, catIds: resolved.catIds, hospitalVisitIds: [] },
      ctx.env.DB,
    );
    return toSaveResult(saved);
  },
  async update({
    ctx,
    connection,
    permissions,
    cat,
    id,
    data,
    existing,
    args,
  }) {
    if (existing.householdId !== cat.householdId) {
      return { error: RECORD_NOT_FOUND_ERROR };
    }
    let catIds = data.catIds;
    if (Array.isArray(args.catIds)) {
      const resolved = await resolveExpenseCatIds(
        ctx,
        cat,
        args,
        permissions,
        connection.userId,
      );
      if ("error" in resolved) return resolved;
      // この接続から支出を書き込めない猫の紐付けは、外す権限が無いため残す
      const hidden = existing.catIds.filter(
        (catId) => !resolved.writable.includes(catId),
      );
      catIds = [...new Set([...resolved.catIds, ...hidden])];
    }
    const saved = await updateExpense(
      cat.householdId,
      id,
      { ...data, catIds },
      ctx.env.DB,
    );
    return toSaveResult(saved);
  },
});

function toSaveResult(
  saved: Awaited<ReturnType<typeof createExpense>>,
): SaveResult {
  if ("id" in saved) return saved;
  if ("formError" in saved) return { error: saved.formError };
  return {
    error: Object.values(saved.fieldErrors).flat().join(" / "),
  };
}

const feedingItemSchema = z.object({
  foodProductId: z
    .string()
    .describe("ごはん商品の ID（list_food_products で取得できる）"),
  givenAmountG: z.number().optional().describe("与えた量（g、厳格モード）"),
  leftoverAmountG: z.number().optional().describe("残した量（g、厳格モード）"),
  givenAmountLevel: z
    .enum(GIVEN_AMOUNT_LEVELS)
    .optional()
    .describe("与えた量（あいまいモード）"),
  leftoverLevel: z
    .enum(LEFTOVER_LEVELS)
    .optional()
    .describe("残した量（あいまいモード）"),
});

const feedingRecordTool = defineRecordTool({
  recordType: "feeding",
  name: "feeding_record",
  label: "ごはんの記録",
  description:
    "mode（記録方法）と items（商品ごとの量）は追加では必須。" +
    'mode="strict"（厳格モード）では各商品に givenAmountG（与えた量）と leftoverAmountG（残した量）を' +
    "グラムで指定し、推定摂取量・推定カロリーを計算する。" +
    'mode="approximate"（あいまいモード）では givenAmountLevel（less=少なめ、normal=普通、more=多め）と' +
    "leftoverLevel（none=完食、little=少し残し、most=ほとんど残し）を指定する。" +
    "商品は猫の家のごはん商品に限る。編集で items を指定すると、商品の明細をすべて置き換える。",
  fields: {
    occurredDate: dateField("記録日"),
    occurredTime: timeField("記録時刻"),
    mode: z.enum(["strict", "approximate"]).optional(),
    items: z.array(feedingItemSchema).optional(),
  },
  schema: feedingRecordFormSchema,
  defaults: () => nowDateTimeValues("occurredDate", "occurredTime"),
  async load(db, catId, id) {
    const [row] = await db
      .select()
      .from(feedingRecords)
      .where(and(eq(feedingRecords.id, id), eq(feedingRecords.catId, catId)))
      .limit(1);
    if (!row) return null;
    const items = await db
      .select()
      .from(feedingRecordItems)
      .where(eq(feedingRecordItems.feedingRecordId, id))
      .orderBy(asc(feedingRecordItems.sortOrder));
    return {
      existing: null,
      values: {
        ...dateTimeValues("occurredDate", "occurredTime", row.occurredAt),
        mode: row.mode,
        items: items.map((item) => ({
          foodProductId: item.foodProductId,
          givenAmountG: item.givenAmountG ?? undefined,
          leftoverAmountG: item.leftoverAmountG ?? undefined,
          givenAmountLevel: item.givenAmountLevel ?? undefined,
          leftoverLevel: item.leftoverLevel ?? undefined,
        })),
      },
    };
  },
  create: ({ ctx, cat, data }) => createFeedingRecord(cat, data, ctx.env.DB),
  update: ({ ctx, cat, id, data }) =>
    updateFeedingRecord(cat, id, data, ctx.env.DB),
});

const RECORD_TOOLS = [
  feedingRecordTool,
  poopRecordTool,
  weightRecordTool,
  vomitRecordTool,
  waterRecordTool,
  shampooRecordTool,
  brushingRecordTool,
  cleaningRecordTool,
  symptomTool,
  medicationDoseTool,
  hospitalVisitTool,
  expenseTool,
  memoTool,
] as const;

/** 引数のうち、フォームの値に含めるものだけを取り出す */
function formArgs(
  args: Record<string, unknown>,
  nonFormKeys: string[] = [],
): Record<string, unknown> {
  const { catId: _catId, id: _id, ...rest } = args;
  for (const key of nonFormKeys) {
    delete rest[key];
  }
  return rest;
}

function registerRecordTool<TData, TExisting>(
  server: McpServer,
  ctx: McpToolContext,
  definition: RecordToolDefinition<TData, TExisting>,
) {
  const { recordType, label } = definition;
  const catIdField = z.string().describe("猫の ID（list_cats で取得できる）");

  server.registerTool(
    `create_${definition.name}`,
    {
      title: `${label}を追加`,
      description:
        `猫の${label}を 1 件追加し、追加した記録の ID を返す。` +
        "日時を省略すると今の日時で記録する。" +
        COMMON_DESCRIPTION +
        definition.description,
      inputSchema: { catId: catIdField, ...definition.fields },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async (args: Record<string, unknown>) => {
      const catId = args.catId as string;
      const resolved = await resolveWritableCat(ctx, catId, recordType, label);
      if ("error" in resolved) {
        return errorResult(resolved.error);
      }
      const values = mergeFormValues(
        definition.defaults(),
        formArgs(args, definition.nonFormKeys),
      );
      const parsed = parseFormValues(
        definition.schema,
        definition.adjust?.(values, args) ?? values,
      );
      if ("error" in parsed) {
        return errorResult(parsed.error);
      }
      const saved = await definition.create({
        ctx,
        connection: resolved.connection,
        permissions: resolved.permissions,
        cat: resolved.cat,
        data: parsed.data,
        args,
      });
      if ("error" in saved) {
        return errorResult(saved.error);
      }
      return jsonResult({ id: saved.id });
    },
  );

  server.registerTool(
    `update_${definition.name}`,
    {
      title: `${label}を編集`,
      description:
        `猫の${label}を 1 件編集する。記録の ID は list_timeline で取得できる。` +
        COMMON_DESCRIPTION +
        definition.description,
      inputSchema: {
        catId: catIdField,
        id: z.string().describe("記録の ID"),
        ...definition.fields,
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
      },
    },
    async (args: Record<string, unknown>) => {
      const catId = args.catId as string;
      const id = args.id as string;
      const resolved = await resolveWritableCat(ctx, catId, recordType, label);
      if ("error" in resolved) {
        return errorResult(resolved.error);
      }
      const loaded = await definition.load(getDb(ctx.env.DB), catId, id);
      if (!loaded) {
        return errorResult(`id="${id}" の${label}が見つかりません`);
      }
      const values = mergeFormValues(
        loaded.values,
        formArgs(args, definition.nonFormKeys),
      );
      const parsed = parseFormValues(
        definition.schema,
        definition.adjust?.(values, args) ?? values,
      );
      if ("error" in parsed) {
        return errorResult(parsed.error);
      }
      const saved = await definition.update({
        ctx,
        connection: resolved.connection,
        permissions: resolved.permissions,
        cat: resolved.cat,
        id,
        data: parsed.data,
        existing: loaded.existing,
        args,
      });
      if ("error" in saved) {
        return errorResult(saved.error);
      }
      return jsonResult({ id: saved.id });
    },
  );
}

/**
 * 記録の追加・編集のツールと、記録に必要な ID を調べるツール（掃除対象・服薬予定の一覧）、
 * タイムラインに載らないメモを読むツール（メモの一覧）を登録する。書き込めるのは、接続に書き込みを許可していて、読み取りも許可している
 * 猫・記録の種類に限る（`./context.ts` の `resolveWritableCat`）
 */
export function registerRecordTools(server: McpServer, ctx: McpToolContext) {
  for (const definition of RECORD_TOOLS) {
    registerRecordTool(
      server,
      ctx,
      definition as RecordToolDefinition<unknown, unknown>,
    );
  }

  server.registerTool(
    "list_cleaning_targets",
    {
      title: "掃除対象の一覧を取得",
      description:
        "猫の掃除対象（トイレなど）の一覧を取得する。掃除の記録を追加するときの " +
        "cleaningTargetId に使う。isActive が false の掃除対象には記録を追加できない。",
      inputSchema: {
        catId: z.string().describe("猫の ID（list_cats で取得できる）"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ catId }) => {
      const allowed = await resolveReadableCat(ctx, catId, "cleaning");
      if ("error" in allowed) {
        return errorResult(allowed.error);
      }
      const targets = await listCleaningTargets(catId, ctx.env.DB);
      return jsonResult({
        cleaningTargets: targets.map((target) => ({
          id: target.id,
          name: target.name,
          frequencyValue: target.frequencyValue,
          frequencyUnit: target.frequencyUnit,
          isActive: target.isActive,
        })),
      });
    },
  );

  server.registerTool(
    "list_medications",
    {
      title: "服薬予定の一覧を取得",
      description:
        "猫の服薬予定（薬）の一覧を取得する。投薬の記録を追加するときの medicationId に使う。",
      inputSchema: {
        catId: z.string().describe("猫の ID（list_cats で取得できる）"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ catId }) => {
      const allowed = await resolveReadableCat(ctx, catId, "medicationDose");
      if ("error" in allowed) {
        return errorResult(allowed.error);
      }
      const medications = await listMedications(catId, ctx.env.DB);
      return jsonResult({
        medications: medications.map((medication) => ({
          id: medication.id,
          name: medication.name,
          doseAmount: medication.doseAmount,
          dosesPerDay: medication.dosesPerDay,
          startDate: medication.startDate,
          endDate: medication.endDate,
          archived: medication.archivedAt != null,
        })),
      });
    },
  );

  server.registerTool(
    "list_memos",
    {
      title: "メモの一覧を取得",
      description:
        "猫のメモの一覧を取得する。日付を残さないメモ（recordedAt が null）はタイムライン" +
        "（list_timeline）に載らないため、メモを読むときはこのツールを使う。" +
        "日付を残さないメモ（新しく作った順）、日付を残したメモ（recordedAt の新しい順）の順に並ぶ。" +
        `1 ページは ${MEMO_PAGE_SIZE} 件で、hasMore が true なら次のページがある。`,
      inputSchema: {
        catId: z.string().describe("猫の ID（list_cats で取得できる）"),
        page: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe("ページ番号（1始まり、省略時は1）"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ catId, page }) => {
      const allowed = await resolveReadableCat(ctx, catId, "memo");
      if ("error" in allowed) {
        return errorResult(allowed.error);
      }
      const records = await listMemoRecords(catId, ctx.env.DB);
      const paged = paginate(records, page ?? 1, MEMO_PAGE_SIZE);
      return jsonResult({
        memos: paged.items.map((record) => ({
          id: record.id,
          recordedAt: record.recordedAt,
          content: record.content,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        })),
        page: paged.page,
        hasMore: paged.page < paged.totalPages,
      });
    },
  );
}

/** `list_memos` の 1 ページの件数 */
const MEMO_PAGE_SIZE = 50;

/**
 * 読み取りを許可している猫と記録の種類であることを確かめる。許可していない猫・種類は、
 * 存在しない猫と区別しない（`list_timeline` と同じ）
 */
async function resolveReadableCat(
  ctx: McpToolContext,
  catId: string,
  recordType: McpPermissionRecordType,
): Promise<{ ok: true } | { error: string }> {
  const connection = await ctx.resolveConnection();
  if ("error" in connection) {
    return connection;
  }
  const [cat, permissions] = await Promise.all([
    getCatForUser(connection.userId, catId, ctx.env.DB),
    getMcpPermissions(connection.userId, connection.clientId, ctx.env.DB),
  ]);
  if (
    !cat ||
    !isCatAllowedForMcp(permissions, cat) ||
    !allowedMcpRecordTypes(permissions, cat.id).includes(recordType)
  ) {
    return { error: catNotFoundMessage(catId) };
  }
  return { ok: true };
}
