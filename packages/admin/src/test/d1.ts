import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import initSqlJs, { type Database, type SqlValue } from "sql.js";
import type { AdminDb } from "../db/queries";

// メインアプリのマイグレーション（リポジトリルートの `drizzle/`）。管理画面の生 SQL が
// 実際のスキーマと食い違っていないことを確かめるため、同じマイグレーションを適用する
const MIGRATIONS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../drizzle",
);

/** メインアプリのマイグレーションをすべて適用した sql.js の DB を作る */
export async function createMigratedDatabase() {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run("PRAGMA foreign_keys = ON");
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const sql = readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) {
      if (statement.trim()) {
        db.run(statement);
      }
    }
  }
  return db;
}

class SqlJsStatement {
  constructor(
    private readonly db: Database,
    private readonly sql: string,
    private readonly params: SqlValue[] = [],
  ) {}

  bind(...params: SqlValue[]) {
    return new SqlJsStatement(this.db, this.sql, params);
  }

  async all<T>() {
    const statement = this.db.prepare(this.sql);
    try {
      statement.bind(this.params);
      const results: T[] = [];
      while (statement.step()) {
        results.push(statement.getAsObject() as T);
      }
      return { results, success: true, meta: {} };
    } finally {
      statement.free();
    }
  }
}

/**
 * sql.js の DB を、`src/db/queries.ts` が使う範囲（`prepare`・`bind`・`all`・`batch`）だけ
 * D1 と同じ形で呼べるようにする
 */
export function toAdminDb(db: Database): AdminDb {
  return {
    prepare: (sql: string) => new SqlJsStatement(db, sql),
    batch: (statements: SqlJsStatement[]) =>
      Promise.all(statements.map((statement) => statement.all())),
  } as unknown as AdminDb;
}
