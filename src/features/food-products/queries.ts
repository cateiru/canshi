import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { foodProducts } from "@/db/schema";

export async function listFoodProducts() {
  const db = getDb();
  return db.select().from(foodProducts).orderBy(desc(foodProducts.createdAt));
}

export async function getFoodProductById(id: string) {
  const db = getDb();
  const [foodProduct] = await db
    .select()
    .from(foodProducts)
    .where(eq(foodProducts.id, id))
    .limit(1);
  return foodProduct ?? null;
}
