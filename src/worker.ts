import { WorkerEntrypoint } from "cloudflare:workers";
import type { Cat } from "@/db/schema";
import { getOrCreateLoginUser, getUserById } from "@/features/auth/users";
import {
  FEEDING_MODE_LABEL,
  GIVEN_AMOUNT_LEVEL_LABEL,
  LEFTOVER_LEVEL_LABEL,
} from "@/features/feeding-records/labels";
import { getCatForUser, listCatsForUser } from "@/features/households/queries";
import {
  type ListTimelineForMonthOptions,
  listTimelineForMonth,
  type TimelineEntry,
} from "@/features/timeline/queries";
import {
  BCS_LABEL,
  isBodyConditionScore,
} from "@/features/weight-records/labels";

// `.open-next/worker.js` は `opennextjs-cloudflare build`（`pnpm cf:build` 等）で
// 生成される。ビルド前（`.open-next/` が無いクリーンな環境）は型解決できないため抑制する
// @ts-expect-error
import { default as handler } from "../.open-next/worker.js";

// `wrangler.toml` の `[[workflows]]` の `class_name` はこのモジュール（`main`）からの
// export を指す。Workflow の実体は `src/workflows/notification.ts` にある
export { NotificationWorkflow } from "@/workflows/notification";

/** MCP ツール（packages/mcp-server）向けの猫プロフィールの要約 */
function toCatSummary(cat: Cat) {
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
 * 段階での量は値だけでは意味が伝わりにくいため、表示用のラベルを添える
 */
function toRecordSummary(entry: TimelineEntry) {
  if (entry.type === "feeding") {
    const { record } = entry;
    return {
      ...record,
      modeLabel: FEEDING_MODE_LABEL[record.mode],
      items: record.items.map((item) => ({
        ...item,
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
 * URL を含む）は Cloudflare Access 保護下にあり外部エージェントからは参照
 * できないため含めず、件数のみ返す
 */
function toTimelineEntrySummary(entry: TimelineEntry) {
  return {
    id: entry.id,
    type: entry.type,
    occurredAt: entry.occurredAt,
    record: toRecordSummary(entry),
    mediaCount: entry.media.length,
  };
}

// MCP 用 Worker（`packages/mcp-server`）から Service Bindings 経由で呼ばれる
// RPC エントリーポイント（`docs/plans/32_mcp_oidc_overview.md` 参照）。
// 公開 URL・DNS を経由しない Worker 間の直接呼び出しのため、このアプリの
// Cloudflare Access ポリシーやセッション（Cookie）の対象にはならない。
// 呼び出し元（MCP 用 Worker）は OAuth 検証を通過したリクエストのユーザー ID
// （`resolveMcpUser` で取得し、トークンに保存したもの）を必ず渡し、ここでは
// そのユーザーの家の猫だけを返す
export class McpRpc extends WorkerEntrypoint<Env> {
  /**
   * MCP の認可（`/callback`）で、トークンに紐付けるユーザーを決める。認証を実装する
   * までは `/login` のログインボタンと同じく、登録済みのユーザー（いなければ
   * 新しく作った管理者ユーザー）を使う
   */
  async resolveMcpUser() {
    const user = await getOrCreateLoginUser(this.env.DB);
    return { userId: user.id };
  }

  async listCats(userId: string) {
    await this.assertUser(userId);
    const cats = await listCatsForUser(userId, this.env.DB);
    return cats.map(toCatSummary);
  }

  async getCatProfile(userId: string, catId: string) {
    await this.assertUser(userId);
    const cat = await getCatForUser(userId, catId, this.env.DB);
    return cat ? toCatSummary(cat) : null;
  }

  /** 別の家の猫・存在しない猫は区別せず null を返す */
  async listTimeline(
    userId: string,
    catId: string,
    year: number,
    month: number,
    options?: ListTimelineForMonthOptions,
  ) {
    await this.assertUser(userId);
    if (!(await getCatForUser(userId, catId, this.env.DB))) {
      return null;
    }
    const result = await listTimelineForMonth(
      catId,
      year,
      month,
      options,
      this.env.DB,
    );
    return {
      entries: result.entries.map(toTimelineEntrySummary),
      hasMore: result.hasMore,
    };
  }

  /**
   * ユーザー ID を持たない呼び出し（ユーザーの導入前に発行されたトークンなど）や、
   * 削除されたユーザーでの呼び出しを拒否する
   */
  private async assertUser(userId: string) {
    if (!userId || !(await getUserById(userId, this.env.DB))) {
      throw new Error("ユーザーが見つかりません。MCP に接続し直してください");
    }
  }
}

export default {
  fetch: handler.fetch,
  async scheduled(controller, env, ctx) {
    // 同じ scheduledTime での重複実行（cron の at-least-once 配信）は
    // 同じ id での2回目の create() が失敗することで自然に防がれる
    ctx.waitUntil(
      env.NOTIFICATION_WORKFLOW.create({
        id: `notification-${controller.scheduledTime}`,
        params: {},
      }).catch((error) => {
        console.error("NotificationWorkflow の起動に失敗しました", error);
      }),
    );
  },
} satisfies ExportedHandler<Env>;
