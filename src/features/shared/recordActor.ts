import type { RecordActor } from "@/db/schema";

/** 画面からの操作の、記録を操作した人 */
export function userActor(user: { id: string }): RecordActor {
  return { userId: user.id, mcpClientId: null };
}
