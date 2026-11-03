import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";

/** ユーザーの名前を変える */
export async function renameUser(userId: string, name: string): Promise<void> {
  const db = getDb();
  await db
    .update(users)
    .set({ name, updatedAt: new Date() })
    .where(eq(users.id, userId));
}
