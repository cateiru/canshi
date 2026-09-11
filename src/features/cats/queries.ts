import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { cats } from "@/db/schema";

export async function listCats(d1?: D1Database) {
  const db = getDb(d1);
  return db.select().from(cats).orderBy(desc(cats.createdAt));
}

export async function getCatById(id: string, d1?: D1Database) {
  const db = getDb(d1);
  const [cat] = await db.select().from(cats).where(eq(cats.id, id)).limit(1);
  return cat ?? null;
}
