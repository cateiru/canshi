import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { cats } from "@/db/schema";

/**
 * 家を問わずすべての猫を返す。ユーザーによる認可を伴わないため、通知の生成
 * （Workflow）のようにユーザーに表示しない処理だけで使う。画面に表示する猫は
 * `listCurrentUserCats`（`src/features/auth/session.ts`）で取得する
 */
export async function listAllCats(d1?: D1Database) {
  const db = getDb(d1);
  return db.select().from(cats).orderBy(desc(cats.createdAt));
}

export async function getCatById(id: string, d1?: D1Database) {
  const db = getDb(d1);
  const [cat] = await db.select().from(cats).where(eq(cats.id, id)).limit(1);
  return cat ?? null;
}
