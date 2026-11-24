import type { RecordChangeLogAction } from "@/db/schema";
import type { McpClientApp } from "@/features/mcp/domain/clientApp";

/**
 * 記録を作成・編集した人（読み取りのモデル）。記録の履歴（`record_change_logs`）から、
 * 操作した人ごとに 1 件にまとめる。画面からの操作はユーザー、AI との接続（MCP）からの操作は
 * 接続ごとに AI のアプリ、API からの操作はトークンごとに扱う。
 *
 * Client Component へ渡すため、接続（OAuth のクライアント）・トークンの ID は持たせない
 */
export type RecordContributor =
  | {
      kind: "user";
      userName: string;
      /** アイコン画像。画像がない・見る権限がない（同じ家にいない）ときは null */
      iconMediaAssetId: string | null;
    }
  | {
      kind: "ai";
      /** 接続を許可したユーザーの名前 */
      userName: string;
      /** アプリが名乗った名前（自己申告）。わからなければ null */
      clientName: string | null;
      /** アイコンを見分けられるアプリ。わからなければ null */
      app: McpClientApp | null;
    }
  | {
      kind: "api";
      /** トークンを発行したユーザーの名前 */
      userName: string;
      /** トークンの名前。削除されたトークンなら null */
      tokenName: string | null;
    };

/** アプリの名前がわからないときの表示 */
const UNNAMED_AI_APP = "AIのアプリ";

/** 削除されたトークンの表示 */
const DELETED_API_TOKEN = "削除されたトークン";

/** 作成・編集した人の名前（ツールチップ・読み上げ用） */
export function formatRecordContributorLabel(
  contributor: RecordContributor,
): string {
  if (contributor.kind === "user") {
    return contributor.userName;
  }
  if (contributor.kind === "api") {
    return `${contributor.tokenName ?? DELETED_API_TOKEN}（${contributor.userName}のAPIトークン）`;
  }
  return `${contributor.clientName ?? UNNAMED_AI_APP}（${contributor.userName}が接続）`;
}

/** 作成・編集の履歴の 1 件（1 回の保存） */
export type RecordChangeHistoryEntry = {
  /**
   * 作成か編集か。履歴を残し始める（`0064`）より前に作られた記録では、作成の履歴が無く、
   * 先頭が編集になる
   */
  action: Exclude<RecordChangeLogAction, "delete">;
  /** 保存した人。`RecordContributions.contributors` の添字 */
  contributorIndex: number;
  /** 保存した日時 */
  changedAt: Date;
};

/**
 * 1 件の記録を作成・編集した人と、その履歴。同じ人の保存をまとめて見分けるために、
 * 接続の ID の代わりに `contributors` の添字で人を指す
 */
export type RecordContributions = {
  /** 作成・編集した人（最初に操作した順。作成した人が先頭） */
  contributors: RecordContributor[];
  /** 作成・編集の履歴（古い順） */
  history: RecordChangeHistoryEntry[];
};
