import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import { chunkForBoundParameters } from "@/db/batch";
import { getDb } from "@/db/client";
import {
  type RecordChangeLogRecordType,
  recordChangeLogs,
  users,
} from "@/db/schema";
import { listUserIdsSharingHousehold } from "@/features/households/infrastructure/queries";
import {
  getMcpClientSummary,
  type McpClientSummary,
} from "@/features/mcp/infrastructure/connections";
import type { RecordContributor } from "../domain/contributor";

/** 作成・編集した人を求める記録 */
export type RecordContributorRef = {
  recordType: RecordChangeLogRecordType;
  recordId: string;
};

/** `listRecordContributors` の結果のキー */
export function recordContributorKey(
  recordType: RecordChangeLogRecordType,
  recordId: string,
): string {
  return `${recordType}:${recordId}`;
}

type ContributionRow = {
  recordType: RecordChangeLogRecordType;
  recordId: string;
  userId: string;
  mcpClientId: string | null;
  userName: string;
  iconMediaAssetId: string | null;
};

/**
 * 記録ごとに、作成・編集した人を最初に操作した順（作成した人が先頭）で返す。キーは
 * `recordContributorKey`。履歴（`record_change_logs`）の無い記録（`0064` より前に作られ、
 * その後に編集されていない記録）はキーを含めない。
 *
 * - 削除の履歴は含めない（読む記録は削除されていない前提）
 * - 同じユーザーでも、画面からの操作と AI との接続からの操作、接続どうしは別の人として扱う
 * - アイコン画像は、見る人（`viewerUserId`）と同じ家にいるユーザーの分だけ返す。家から
 *   外れたユーザーの画像は見る権限がない（`canAccessMediaAsset`）ため
 * - 呼び出し元で、見る人が記録を参照できることを確かめておくこと
 */
export async function listRecordContributors(
  refs: readonly RecordContributorRef[],
  viewerUserId: string,
  d1?: D1Database,
): Promise<Map<string, RecordContributor[]>> {
  const result = new Map<string, RecordContributor[]>();
  const idsByType = new Map<RecordChangeLogRecordType, Set<string>>();
  for (const { recordType, recordId } of refs) {
    const ids = idsByType.get(recordType) ?? new Set<string>();
    ids.add(recordId);
    idsByType.set(recordType, ids);
  }
  if (idsByType.size === 0) {
    return result;
  }

  const db = getDb(d1);
  const rows: ContributionRow[] = [];
  for (const [recordType, ids] of idsByType) {
    // 記録の種類・削除の 2 個分を差し引いて分割する。記録ごとに分割するため、
    // 同じ記録の履歴が複数のチャンクにまたがることはない
    for (const chunk of chunkForBoundParameters([...ids], 2)) {
      rows.push(
        ...(await db
          .select({
            recordType: recordChangeLogs.recordType,
            recordId: recordChangeLogs.recordId,
            userId: recordChangeLogs.userId,
            mcpClientId: recordChangeLogs.mcpClientId,
            userName: users.name,
            iconMediaAssetId: users.iconMediaAssetId,
          })
          .from(recordChangeLogs)
          .innerJoin(users, eq(recordChangeLogs.userId, users.id))
          .where(
            and(
              eq(recordChangeLogs.recordType, recordType),
              inArray(recordChangeLogs.recordId, chunk),
              ne(recordChangeLogs.action, "delete"),
            ),
          )
          // 同じ秒の操作は追加した順にする（`id` は UUID のため順番を表さない）
          .orderBy(
            asc(recordChangeLogs.createdAt),
            sql`${recordChangeLogs}.rowid`,
          )),
      );
    }
  }
  if (rows.length === 0) {
    return result;
  }

  const visibleIconUserIds = await listUserIdsSharingHousehold(
    viewerUserId,
    rows.map((row) => row.userId),
    d1,
  );
  const clientSummaries = await loadMcpClientSummaries(rows, d1);

  const seen = new Set<string>();
  for (const row of rows) {
    const key = recordContributorKey(row.recordType, row.recordId);
    const contributorKey = `${key}\0${row.userId}\0${row.mcpClientId ?? ""}`;
    if (seen.has(contributorKey)) {
      continue;
    }
    seen.add(contributorKey);
    const contributors = result.get(key) ?? [];
    if (row.mcpClientId === null) {
      contributors.push({
        kind: "user",
        userName: row.userName,
        iconMediaAssetId: visibleIconUserIds.has(row.userId)
          ? row.iconMediaAssetId
          : null,
      });
    } else {
      const summary = clientSummaries.get(
        clientSummaryKey(row.userId, row.mcpClientId),
      );
      contributors.push({
        kind: "ai",
        userName: row.userName,
        clientName: summary?.clientName ?? null,
        app: summary?.app ?? null,
      });
    }
    result.set(key, contributors);
  }
  return result;
}

function clientSummaryKey(userId: string, clientId: string) {
  return `${userId}\0${clientId}`;
}

/** 履歴に現れる接続ごとに、AI のアプリの名前とアイコンを求める */
async function loadMcpClientSummaries(
  rows: readonly ContributionRow[],
  d1?: D1Database,
): Promise<Map<string, McpClientSummary>> {
  const pairs = new Map<string, { userId: string; clientId: string }>();
  for (const { userId, mcpClientId } of rows) {
    if (mcpClientId !== null) {
      pairs.set(clientSummaryKey(userId, mcpClientId), {
        userId,
        clientId: mcpClientId,
      });
    }
  }
  const entries = await Promise.all(
    [...pairs].map(
      async ([key, { userId, clientId }]) =>
        [key, await getMcpClientSummary(userId, clientId, d1)] as const,
    ),
  );
  return new Map(entries);
}
