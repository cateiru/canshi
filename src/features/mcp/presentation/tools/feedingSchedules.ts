import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import type { FeedingSchedule } from "@/db/schema";
import {
  createFeedingSchedule,
  deleteFeedingSchedule,
  updateFeedingScheduleNotify,
} from "@/features/feeding-schedules/application/mutations";
import {
  feedingScheduleFormSchema,
  feedingScheduleNotifyFormSchema,
} from "@/features/feeding-schedules/domain/schema";
import {
  getFeedingSchedule,
  getFeedingScheduleByTime,
  listFeedingSchedulesByHouseholdIds,
} from "@/features/feeding-schedules/infrastructure/queries";
import {
  isHouseholdOperationAllowedForMcp,
  type McpHouseholdOperation,
} from "../../domain/permissionRules";
import {
  mergeFormValues,
  parseFormValues,
  toCheckboxValue,
} from "../formValues";
import {
  errorResult,
  jsonResult,
  listAllowedHouseholds,
  type McpConnection,
  type McpToolContext,
  operationNotAllowedMessage,
  resolveHouseholdIdsForOperation,
  resolveHouseholdOperation,
  resolvePermissions,
} from "./context";

const SCHEDULE_DESCRIPTION =
  "ごはんの時間は家ごとに登録し、その時刻になったときの通知（notifyAtTime）と、" +
  "時刻を過ぎてもごはんの記録がないときのリマインダー（remindIfNotRecorded）を家のメンバーに送る。" +
  "時刻は日本時間。";

const notifyFields = {
  notifyAtTime: z
    .boolean()
    .optional()
    .describe("ごはんの時間になったら通知するか"),
  remindIfNotRecorded: z
    .boolean()
    .optional()
    .describe("ごはんの記録がなければリマインダーを送るか"),
};

function toScheduleSummary(schedule: FeedingSchedule) {
  return {
    id: schedule.id,
    householdId: schedule.householdId,
    time: schedule.time,
    notifyAtTime: schedule.notifyAtTime,
    remindIfNotRecorded: schedule.remindIfNotRecorded,
  };
}

function scheduleNotFoundMessage(id: string) {
  return `id="${id}" のごはんの時間が見つかりません`;
}

/**
 * ユーザーが所属し、読み取りを許可している家のごはんの時間で、その家で操作も許可しているときに
 * ごはんの時間を読む。行えなければ AI に返すエラーメッセージ
 */
async function resolveSchedule(
  ctx: McpToolContext,
  operation: McpHouseholdOperation,
  id: string,
): Promise<
  { connection: McpConnection; schedule: FeedingSchedule } | { error: string }
> {
  const resolved = await resolvePermissions(ctx);
  if ("error" in resolved) {
    return resolved;
  }
  const schedule = await getFeedingSchedule(id, ctx.env.DB);
  // ほかの人の家・読み取りを許可していない家のごはんの時間は、存在しないものと区別しない
  const households = schedule
    ? await listAllowedHouseholds(
        ctx,
        resolved.connection.userId,
        resolved.permissions,
      )
    : [];
  const household = households.find(
    ({ id: householdId }) => householdId === schedule?.householdId,
  );
  if (!schedule || !household) {
    return { error: scheduleNotFoundMessage(id) };
  }
  if (
    !isHouseholdOperationAllowedForMcp(
      resolved.permissions,
      household.id,
      operation,
    )
  ) {
    return { error: operationNotAllowedMessage(operation, household.name) };
  }
  return { connection: resolved.connection, schedule };
}

/**
 * ごはんの時間の読み取り・追加・編集・削除のツールを登録する。扱えるのは、読み取りを
 * 許可している家で、その操作を許可している家のごはんの時間に限る
 */
export function registerFeedingScheduleTools(
  server: McpServer,
  ctx: McpToolContext,
) {
  server.registerTool(
    "list_feeding_schedules",
    {
      title: "ごはんの時間の一覧を取得",
      description:
        "家のごはんの時間を、家ごとに時刻順で取得する。" +
        "householdId を指定するとその家のごはんの時間に絞り込む。" +
        "ユーザーがごはんの時間の読み取りを許可している家のものだけを含む。" +
        SCHEDULE_DESCRIPTION,
      inputSchema: {
        householdId: z
          .string()
          .optional()
          .describe("家の ID（list_households で取得できる）"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ householdId }) => {
      const resolved = await resolveHouseholdIdsForOperation(
        ctx,
        "feedingSchedule:read",
        householdId,
      );
      if ("error" in resolved) {
        return errorResult(resolved.error);
      }
      const schedules = await listFeedingSchedulesByHouseholdIds(
        resolved.householdIds,
        ctx.env.DB,
      );
      return jsonResult({ feedingSchedules: schedules.map(toScheduleSummary) });
    },
  );

  server.registerTool(
    "create_feeding_schedule",
    {
      title: "ごはんの時間を追加",
      description:
        "家にごはんの時間を 1 件追加し、追加したごはんの時間を返す。" +
        "同じ家に同じ時刻は 1 つだけ。通知の設定は省略するとどちらも送る。" +
        SCHEDULE_DESCRIPTION,
      inputSchema: {
        householdId: z
          .string()
          .describe(
            "ごはんの時間を追加する家の ID（list_households で取得できる）",
          ),
        time: z
          .string()
          .describe("時刻（HH:mm、日本時間の 24 時間表記）。15 分刻み"),
        ...notifyFields,
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async (args) => {
      const resolved = await resolveHouseholdOperation(
        ctx,
        args.householdId,
        "feedingSchedule:create",
      );
      if ("error" in resolved) {
        return errorResult(resolved.error);
      }
      const parsed = parseFormValues(
        feedingScheduleFormSchema,
        mergeFormValues(
          // 画面のフォームと同じく、通知はどちらも送る状態から始める
          { notifyAtTime: "on", remindIfNotRecorded: "on" },
          {
            time: args.time,
            notifyAtTime: args.notifyAtTime,
            remindIfNotRecorded: args.remindIfNotRecorded,
          },
        ),
      );
      if ("error" in parsed) {
        return errorResult(parsed.error);
      }
      const result = await createFeedingSchedule(
        args.householdId,
        resolved.connection.userId,
        parsed.data,
        ctx.env.DB,
      );
      if (!result.ok) {
        return errorResult(result.error);
      }
      const created = await getFeedingScheduleByTime(
        args.householdId,
        parsed.data.time,
        ctx.env.DB,
      );
      return jsonResult(created ? toScheduleSummary(created) : {});
    },
  );

  server.registerTool(
    "update_feeding_schedule",
    {
      title: "ごはんの時間の通知の設定を変更",
      description:
        "ごはんの時間の通知の設定を変更する。指定した項目だけを変更し、省略した項目は今の値のまま。" +
        "時刻は変えられないため、変えるときは削除してから追加し直す。" +
        "オフにした種類の、まだ対応していない通知は無視にする。" +
        SCHEDULE_DESCRIPTION,
      inputSchema: {
        id: z
          .string()
          .describe("ごはんの時間の ID（list_feeding_schedules で取得できる）"),
        ...notifyFields,
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
      },
    },
    async (args) => {
      const resolved = await resolveSchedule(
        ctx,
        "feedingSchedule:update",
        args.id,
      );
      if ("error" in resolved) {
        return errorResult(resolved.error);
      }
      const { schedule } = resolved;
      const parsed = parseFormValues(
        feedingScheduleNotifyFormSchema,
        mergeFormValues(
          {
            notifyAtTime: toCheckboxValue(schedule.notifyAtTime),
            remindIfNotRecorded: toCheckboxValue(schedule.remindIfNotRecorded),
          },
          {
            notifyAtTime: args.notifyAtTime,
            remindIfNotRecorded: args.remindIfNotRecorded,
          },
        ),
      );
      if ("error" in parsed) {
        return errorResult(parsed.error);
      }
      const result = await updateFeedingScheduleNotify(
        schedule.householdId,
        resolved.connection.userId,
        schedule.id,
        parsed.data,
        ctx.env.DB,
      );
      if (!result.ok) {
        return errorResult(result.error);
      }
      return jsonResult(toScheduleSummary({ ...schedule, ...parsed.data }));
    },
  );

  server.registerTool(
    "delete_feeding_schedule",
    {
      title: "ごはんの時間を削除",
      description:
        "ごはんの時間を 1 件削除する。この時間の、まだ対応していない通知は無視にする。" +
        "ごはんの記録は消えない。",
      inputSchema: {
        id: z
          .string()
          .describe("ごはんの時間の ID（list_feeding_schedules で取得できる）"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
      },
    },
    async ({ id }) => {
      const resolved = await resolveSchedule(ctx, "feedingSchedule:delete", id);
      if ("error" in resolved) {
        return errorResult(resolved.error);
      }
      const result = await deleteFeedingSchedule(
        resolved.schedule.householdId,
        resolved.connection.userId,
        id,
        ctx.env.DB,
      );
      if (!result.ok) {
        return errorResult(result.error);
      }
      return jsonResult({ id, deleted: true });
    },
  );
}
