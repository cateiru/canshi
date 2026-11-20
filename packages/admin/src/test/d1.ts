import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import initSqlJs, {
  type Database,
  type SqlValue,
  type Statement,
} from "sql.js";
import { type AdminDb, createAdminDb } from "../db/client";

// メインアプリのマイグレーション（リポジトリルートの `drizzle/`）。管理画面のクエリが
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

  private collect<T>(read: (statement: Statement) => T) {
    const statement = this.db.prepare(this.sql);
    try {
      statement.bind(this.params);
      const rows: T[] = [];
      while (statement.step()) {
        rows.push(read(statement));
      }
      return rows;
    } finally {
      statement.free();
    }
  }

  async all<T>() {
    const results = this.collect((statement) => statement.getAsObject() as T);
    return {
      results,
      success: true,
      meta: { changes: this.db.getRowsModified() },
    };
  }

  async raw<T>() {
    return this.collect((statement) => statement.get() as T);
  }

  async first<T>() {
    return (await this.all<T>()).results[0] ?? null;
  }

  async run() {
    return this.all();
  }
}

/**
 * sql.js の DB を、Drizzle の D1 ドライバーと `app.test.tsx` が使う範囲
 * （`prepare`・`bind`・`all`・`raw`・`first`・`run`・`batch`）だけ D1 と同じ形で呼べるようにする。
 * `batch` は D1 と同じく 1 つのトランザクションで実行し、どれかが失敗したらすべて取り消す
 */
export function toD1(db: Database): D1Database {
  return {
    prepare: (sql: string) => new SqlJsStatement(db, sql),
    batch: async (statements: SqlJsStatement[]) => {
      db.run("BEGIN");
      try {
        const results = [];
        for (const statement of statements) {
          results.push(await statement.all());
        }
        db.run("COMMIT");
        return results;
      } catch (error) {
        db.run("ROLLBACK");
        throw error;
      }
    },
  } as unknown as D1Database;
}

/** sql.js の DB を使う、管理画面の Drizzle のインスタンスを作る */
export function toAdminDb(db: Database): AdminDb {
  return createAdminDb(toD1(db));
}
