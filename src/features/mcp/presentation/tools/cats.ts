import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import type { Cat } from "@/db/schema";
import {
  type CatValues,
  createCatForUser,
  HOUSEHOLD_NOT_ALLOWED_ERROR,
  updateCatForUser,
} from "@/features/cats/application/mutations";
import {
  BIRTH_DATE_PRECISIONS,
  type BirthDatePrecision,
  catFormSchema,
  resolveBirthDate,
} from "@/features/cats/domain/schema";
import { listCleaningTargets } from "@/features/cleaning/infrastructure/targetQueries";
import { getCatForUser } from "@/features/households/infrastructure/queries";
import { saveCatNotificationSettings } from "@/features/notifications/application/settingsUpsert";
import { catNotificationSettingsFormSchema } from "@/features/notifications/domain/settingsSchema";
import { getResolvedSettingsForCat } from "@/features/notifications/infrastructure/queries";
import {
  type FormValues,
  mergeFormValues,
  parseFormValues,
  toCheckboxValue,
} from "../formValues";
import { toCatSummary } from "../summaries";
import {
  checkHouseholdOperation,
  errorResult,
  jsonResult,
  type McpToolContext,
  resolveCatOperation,
  resolveHouseholdOperation,
} from "./context";

const CAT_DESCRIPTION =
  "sex（性別）は male=オス、female=メス、unknown=不明。" +
  "birthDatePrecision は生年月日のわかっている範囲（year=年のみ、month=年月のみ、day=年月日すべて）。" +
  "year・month の場合、birthDate の不明な月・日は 01 にする（例: 2020年5月生まれなら 2020-05-01）。";

const catFields = {
  name: z.string().optional().describe("名前（50文字以内）"),
  sex: z.enum(["male", "female", "unknown"]).optional(),
  birthDate: z
    .string()
    .nullable()
    .optional()
    .describe("生年月日（YYYY-MM-DD）。null を指定すると空にする"),
  birthDatePrecision: z.enum(BIRTH_DATE_PRECISIONS).optional(),
  breed: z
    .string()
    .nullable()
    .optional()
    .describe("猫種（50文字以内）。null を指定すると空にする"),
  adoptedAt: z
    .string()
    .nullable()
    .optional()
    .describe("お迎え日（YYYY-MM-DD）。null を指定すると空にする"),
};

const INVALID_BIRTH_DATE_ERROR =
  "入力が正しくありません。birthDate: 生年月日は YYYY-MM-DD の形式で指定してください";

/**
 * 生年月日（`YYYY-MM-DD`）とわかっている範囲を、猫のフォームの生年月日の入力欄の値に直す。
 * 年のみ・年月のみの場合は、フォームと同じく年・月の入力欄に分ける
 */
function birthDateFormValues(
  birthDate: string | null,
  precision: BirthDatePrecision,
): FormValues | null {
  const empty = { birthDatePrecision: precision, birthDate: "" };
  if (birthDate === null || precision === "day") {
    return { ...empty, birthDate: birthDate ?? "" };
  }
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(birthDate);
  if (!match) {
    return null;
  }
  return {
    ...empty,
    birthYear: match[1],
    birthMonth: precision === "month" ? String(Number(match[2])) : "",
  };
}

/** 猫の項目の引数をフォームの値に直し、フォームと同じ検証を通す */
function parseCatValues(
  base: { values: FormValues; birthDate: string | null },
  args: Record<string, unknown>,
): { data: CatValues } | { error: string } {
  const {
    birthDate: argBirthDate,
    birthDatePrecision: argPrecision,
    catId: _catId,
    ...rest
  } = args;
  const precision = (argPrecision ??
    base.values.birthDatePrecision) as BirthDatePrecision;
  const birthDate =
    argBirthDate === undefined ? base.birthDate : (argBirthDate as string);
  const birthValues = birthDateFormValues(birthDate, precision);
  if (!birthValues) {
    return { error: INVALID_BIRTH_DATE_ERROR };
  }
  const parsed = parseFormValues(catFormSchema, {
    ...mergeFormValues(base.values, rest),
    ...birthValues,
  });
  if ("error" in parsed) {
    return parsed;
  }
  const birth = resolveBirthDate(parsed.data);
  if (!birth.success) {
    return {
      error: `入力が正しくありません。${Object.values(birth.fieldErrors).flat().join(" / ")}`,
    };
  }
  return {
    data: {
      name: parsed.data.name,
      sex: parsed.data.sex,
      birthDate: birth.data.birthDate,
      birthDatePrecision: birth.data.birthDatePrecision,
      breed: parsed.data.breed ?? null,
      adoptedAt: parsed.data.adoptedAt ?? null,
      householdId: parsed.data.householdId,
    },
  };
}

function catCurrentValues(cat: Cat & { householdId: string }) {
  return {
    birthDate: cat.birthDate,
    values: {
      name: cat.name,
      sex: cat.sex,
      birthDatePrecision: cat.birthDatePrecision,
      breed: cat.breed ?? "",
      adoptedAt: cat.adoptedAt ?? "",
      householdId: cat.householdId,
    },
  };
}

/** 通知の設定の項目。取得の結果と編集の引数で同じ名前を使う */
const notificationFields = {
  birthdayYearlyEnabled: z
    .boolean()
    .optional()
    .describe("年ごとの誕生日を通知するか"),
  birthdayHalfYearEnabled: z
    .boolean()
    .optional()
    .describe("半年ごとの節目を通知するか"),
  daysMilestoneEnabled: z
    .boolean()
    .optional()
    .describe("生後 100 日ごとの節目を通知するか"),
  shampooElapsedEnabled: z
    .boolean()
    .optional()
    .describe(
      "前回のシャンプーから shampooElapsedMonths か月たったら通知するか",
    ),
  shampooElapsedMonths: z
    .number()
    .int()
    .optional()
    .describe("シャンプーの通知までの月数（1 以上）"),
  weightMeasurementEnabled: z
    .boolean()
    .optional()
    .describe(
      "前回の体重の記録から weightMeasurementDays 日たったら体重測定を提案するか",
    ),
  weightMeasurementDays: z
    .number()
    .int()
    .optional()
    .describe("体重測定の提案までの日数（1 以上）"),
  symptomOngoingEnabled: z
    .boolean()
    .optional()
    .describe("1 か月以上解消していない症状を確認する通知を送るか"),
};

/**
 * 猫のプロフィール（追加・編集）と、猫ごとの通知の設定のツールを登録する。扱えるのは、
 * 読み取りを許可している家・猫で、猫の家でその操作を許可しているときに限る。猫の削除は扱わない
 */
export function registerCatTools(server: McpServer, ctx: McpToolContext) {
  server.registerTool(
    "create_cat",
    {
      title: "猫を追加",
      description:
        "家に猫を 1 匹登録し、登録した猫のプロフィールを返す。name・sex は必須。" +
        "追加した猫の記録を書き込むには、ユーザーが CANSHI の設定の「AIとの接続」で" +
        "その猫の記録の書き込みを許可する必要がある。" +
        CAT_DESCRIPTION,
      inputSchema: {
        householdId: z
          .string()
          .describe("猫を登録する家の ID（list_households で取得できる）"),
        ...catFields,
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async (args) => {
      const resolved = await resolveHouseholdOperation(
        ctx,
        args.householdId,
        "cat:create",
      );
      if ("error" in resolved) {
        return errorResult(resolved.error);
      }
      const parsed = parseCatValues(
        {
          birthDate: null,
          values: { birthDatePrecision: "day", householdId: args.householdId },
        },
        args,
      );
      if ("error" in parsed) {
        return errorResult(parsed.error);
      }
      const createdId = await createCatForUser(
        resolved.connection.userId,
        parsed.data,
        ctx.env.DB,
      );
      const created =
        createdId &&
        (await getCatForUser(
          resolved.connection.userId,
          createdId,
          ctx.env.DB,
        ));
      if (!created) {
        return errorResult(HOUSEHOLD_NOT_ALLOWED_ERROR);
      }
      return jsonResult(toCatSummary(created));
    },
  );

  server.registerTool(
    "update_cat",
    {
      title: "猫のプロフィールを編集",
      description:
        "猫のプロフィールを編集し、編集後のプロフィールを返す。" +
        "指定した項目だけを変更し、省略した項目は今の値のまま。" +
        "householdId に今と別の家を指定すると、猫を記録ごとその家へ引っ越す" +
        "（引っ越し先の家でも猫のプロフィールの編集を許可している必要がある）。" +
        CAT_DESCRIPTION,
      inputSchema: {
        catId: z.string().describe("猫の ID（list_cats で取得できる）"),
        householdId: z
          .string()
          .optional()
          .describe(
            "引っ越し先の家の ID（list_households で取得できる）。引っ越さないときは省略する",
          ),
        ...catFields,
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
      },
    },
    async (args) => {
      const resolved = await resolveCatOperation(ctx, args.catId, "cat:update");
      if ("error" in resolved) {
        return errorResult(resolved.error);
      }
      const { cat } = resolved;
      if (
        args.householdId !== undefined &&
        args.householdId !== cat.householdId
      ) {
        const error = await checkHouseholdOperation(
          ctx,
          resolved,
          args.householdId,
          "cat:update",
        );
        if (error) {
          return errorResult(error);
        }
      }
      const parsed = parseCatValues(catCurrentValues(cat), args);
      if ("error" in parsed) {
        return errorResult(parsed.error);
      }
      const result = await updateCatForUser(
        cat.id,
        resolved.connection.userId,
        parsed.data,
        ctx.env.DB,
      );
      if (result === "household-not-allowed") {
        return errorResult(HOUSEHOLD_NOT_ALLOWED_ERROR);
      }
      const updated =
        result === "updated" &&
        (await getCatForUser(resolved.connection.userId, cat.id, ctx.env.DB));
      if (!updated) {
        return errorResult("猫が見つかりませんでした");
      }
      return jsonResult(toCatSummary(updated));
    },
  );

  server.registerTool(
    "get_cat_notification_settings",
    {
      title: "猫の通知の設定を取得",
      description:
        "猫ごとの通知の設定を取得する。cleaningTargets は掃除対象ごとの、" +
        "次の掃除の予定日に通知するかの設定。",
      inputSchema: {
        catId: z.string().describe("猫の ID（list_cats で取得できる）"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ catId }) => {
      const resolved = await resolveCatOperation(
        ctx,
        catId,
        "catNotification:read",
      );
      if ("error" in resolved) {
        return errorResult(resolved.error);
      }
      return jsonResult(await readNotificationSettings(ctx, catId));
    },
  );

  server.registerTool(
    "update_cat_notification_settings",
    {
      title: "猫の通知の設定を変更",
      description:
        "猫ごとの通知の設定を変更し、変更後の設定を返す。" +
        "指定した項目だけを変更し、省略した項目は今の値のまま。" +
        "cleaningTargets には変更する掃除対象だけを指定する。",
      inputSchema: {
        catId: z.string().describe("猫の ID（list_cats で取得できる）"),
        ...notificationFields,
        cleaningTargets: z
          .array(
            z.object({
              cleaningTargetId: z
                .string()
                .describe(
                  "掃除対象の ID（get_cat_notification_settings・list_cleaning_targets で取得できる）",
                ),
              enabled: z.boolean().describe("次の掃除の予定日に通知するか"),
            }),
          )
          .optional(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
      },
    },
    async ({ catId, cleaningTargets: targetArgs, ...args }) => {
      const resolved = await resolveCatOperation(
        ctx,
        catId,
        "catNotification:update",
      );
      if ("error" in resolved) {
        return errorResult(resolved.error);
      }
      const current = await readNotificationSettings(ctx, catId);
      // 掃除対象は、この猫のものだけを受け付ける
      const unknownTarget = targetArgs?.find(
        ({ cleaningTargetId }) =>
          !current.cleaningTargets.some(
            (target) => target.cleaningTargetId === cleaningTargetId,
          ),
      );
      if (unknownTarget) {
        return errorResult(
          `cleaningTargetId="${unknownTarget.cleaningTargetId}" の掃除対象が見つかりません`,
        );
      }
      const parsed = parseFormValues(
        catNotificationSettingsFormSchema,
        mergeFormValues(
          {
            birthdayYearlyEnabled: toCheckboxValue(
              current.birthdayYearlyEnabled,
            ),
            birthdayHalfYearEnabled: toCheckboxValue(
              current.birthdayHalfYearEnabled,
            ),
            daysMilestoneEnabled: toCheckboxValue(current.daysMilestoneEnabled),
            shampooElapsedEnabled: toCheckboxValue(
              current.shampooElapsedEnabled,
            ),
            shampooElapsedMonths: current.shampooElapsedMonths,
            weightMeasurementEnabled: toCheckboxValue(
              current.weightMeasurementEnabled,
            ),
            weightMeasurementDays: current.weightMeasurementDays,
            symptomOngoingEnabled: toCheckboxValue(
              current.symptomOngoingEnabled,
            ),
          },
          args,
        ),
      );
      if ("error" in parsed) {
        return errorResult(parsed.error);
      }
      await saveCatNotificationSettings(
        catId,
        current.cleaningTargets.map((target) => ({
          id: target.cleaningTargetId,
          isEnabled:
            targetArgs?.find(
              ({ cleaningTargetId }) =>
                cleaningTargetId === target.cleaningTargetId,
            )?.enabled ?? target.enabled,
        })),
        parsed.data,
        ctx.env.DB,
      );
      return jsonResult(await readNotificationSettings(ctx, catId));
    },
  );
}

/** 猫の通知の設定を、編集のツールの引数と同じ名前で読む */
async function readNotificationSettings(ctx: McpToolContext, catId: string) {
  const cleaningTargets = await listCleaningTargets(catId, ctx.env.DB);
  const settings = await getResolvedSettingsForCat(
    catId,
    cleaningTargets.map((target) => target.id),
    ctx.env.DB,
  );
  return {
    birthdayYearlyEnabled: settings.birthdayYearly.isEnabled,
    birthdayHalfYearEnabled: settings.birthdayHalfYear.isEnabled,
    daysMilestoneEnabled: settings.daysMilestone.isEnabled,
    shampooElapsedEnabled: settings.shampooElapsed.isEnabled,
    shampooElapsedMonths: settings.shampooElapsed.months,
    weightMeasurementEnabled: settings.weightMeasurement.isEnabled,
    weightMeasurementDays: settings.weightMeasurement.days,
    symptomOngoingEnabled: settings.symptomOngoing.isEnabled,
    cleaningTargets: cleaningTargets.map((target) => ({
      cleaningTargetId: target.id,
      name: target.name,
      enabled: settings.cleaningDue.get(target.id)?.isEnabled ?? true,
    })),
  };
}
