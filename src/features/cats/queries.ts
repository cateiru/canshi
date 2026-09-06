import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { cats } from "@/db/schema";

export async function listCats() {
  const db = getDb();
  return db.select().from(cats).orderBy(desc(cats.createdAt));
}

export async function getCatById(id: string) {
  const db = getDb();
  const [cat] = await db.select().from(cats).where(eq(cats.id, id));
  return cat ?? null;
}
