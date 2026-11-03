import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import type { UserRepository } from "../domain/userRepository";

/** D1 に保存する `UserRepository`。`d1` を省略すると Next.js のリクエストの D1 を使う */
export function createUserRepository(d1?: D1Database): UserRepository {
  const db = getDb(d1);
  return {
    async rename(userId, name) {
      await db
        .update(users)
        .set({ name, updatedAt: new Date() })
        .where(eq(users.id, userId));
    },
  };
}
