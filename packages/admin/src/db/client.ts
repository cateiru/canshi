import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

/** 管理画面が D1 を読み書きする Drizzle のインスタンスを作る */
export function createAdminDb(d1: D1Database) {
  return drizzle(d1, { schema });
}

export type AdminDb = ReturnType<typeof createAdminDb>;
