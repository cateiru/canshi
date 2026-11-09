import type { RecordChangeLogRecordType } from "@/db/schema";
import { requireUser } from "@/features/auth/presentation/session";
import type { RecordContributor } from "../domain/contributor";
import {
  listRecordContributors,
  type RecordContributorRef,
  recordContributorKey,
} from "../infrastructure/queries";

/**
 * ログイン中のユーザーが見る、1 種類の記録の作成・編集した人を、記録の ID ごとに返す。
 * 記録を参照できることは、呼び出し元（ページ）で確かめておくこと
 */
export async function loadRecordContributors(
  recordType: RecordChangeLogRecordType,
  recordIds: readonly string[],
): Promise<Map<string, RecordContributor[]>> {
  const byKey = await loadRecordContributorsByRef(
    recordIds.map((recordId) => ({ recordType, recordId })),
  );
  const byId = new Map<string, RecordContributor[]>();
  for (const recordId of recordIds) {
    const contributors = byKey.get(recordContributorKey(recordType, recordId));
    if (contributors) {
      byId.set(recordId, contributors);
    }
  }
  return byId;
}

/**
 * ログイン中のユーザーが見る、種類の混ざった記録の作成・編集した人を返す。キーは
 * `recordContributorKey`。記録を参照できることは、呼び出し元で確かめておくこと
 */
export async function loadRecordContributorsByRef(
  refs: readonly RecordContributorRef[],
): Promise<Map<string, RecordContributor[]>> {
  if (refs.length === 0) {
    return new Map();
  }
  const user = await requireUser();
  return listRecordContributors(refs, user.id);
}
