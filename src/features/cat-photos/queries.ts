import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { catPhotos } from "@/db/schema";

export async function listCatPhotos(catId: string) {
  const db = getDb();
  return db
    .select()
    .from(catPhotos)
    .where(eq(catPhotos.catId, catId))
    .orderBy(desc(catPhotos.takenAt));
}

export async function getCatPhotoById(id: string) {
  const db = getDb();
  const [photo] = await db
    .select()
    .from(catPhotos)
    .where(eq(catPhotos.id, id))
    .limit(1);
  return photo ?? null;
}
