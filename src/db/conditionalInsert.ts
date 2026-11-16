import {
  type Column,
  getTableColumns,
  is,
  SQL,
  type SQLWrapper,
  sql,
} from "drizzle-orm";
import type { SQLiteColumn, SQLiteTable } from "drizzle-orm/sqlite-core";
import type { getDb } from "./client";
import { cats } from "./schema";

type Db = ReturnType<typeof getDb>;

/**
 * 論理削除する記録（`deleted_at` を持つ）が、指定した猫のもので削除されずにあるときだけ真になる条件。
 * 記録を参照する列を書き込む文に含め、確認の後に参照先が論理削除された場合に、削除済みの記録を
 * 指したまま保存されないようにする（物理削除のころは外部キー制約が防いでいた）。
 * `id` が null（参照しない）のときは条件を付けない
 */
export function liveRowCondition(
  table: SQLiteTable & {
    id: SQLiteColumn;
    catId: SQLiteColumn;
    deletedAt: SQLiteColumn;
  },
  catId: string,
  id: string | null | undefined,
): SQL | undefined {
  if (id == null) {
    return undefined;
  }
  return sql`EXISTS (
    SELECT 1 FROM ${table}
    WHERE ${table.id} = ${id}
      AND ${table.catId} = ${catId}
      AND ${table.deletedAt} IS NULL
  )`;
}

/**
 * 猫がメモリーへ移されていない（`cats.memorial_date IS NULL`）ときだけ真になる条件。
 * 猫の記録などを書き込む文に含め、画面・MCP での確認（`requireWritableCatAccess`・`resolveWritableCat`）の後、
 * 書き込みの前に別の家族が猫をメモリーへ移した場合に、記録が追加・編集・削除されないようにする
 */
export function writableCatCondition(catId: string): SQL {
  return sql`EXISTS (
    SELECT 1 FROM ${cats}
    WHERE ${cats.id} = ${catId}
      AND ${cats.memorialDate} IS NULL
  )`;
}

/**
 * 猫の記録が削除されずにあり、猫がメモリーへ移されていないときだけ真になる条件
 * （`liveRowCondition` と `writableCatCondition` を合わせたもの）。記録の書き込みと同じ batch に並べる
 * 履歴などの文に含め、記録の文が断られたときに、ほかの文だけが通らないようにする
 */
export function writableRowCondition(
  table: SQLiteTable & {
    id: SQLiteColumn;
    catId: SQLiteColumn;
    deletedAt: SQLiteColumn;
  },
  catId: string,
  id: string,
): SQL {
  return sql`${liveRowCondition(table, catId, id)} AND ${writableCatCondition(catId)}`;
}

/** 列の値を INSERT ... SELECT の SELECT に並べる式にする。値が無ければ列の既定値を使う */
function columnValue(
  column: Column,
  values: Record<string, unknown>,
  key: string,
) {
  if (key in values && values[key] !== undefined) {
    const value = values[key];
    return is(value, SQL) ? value : sql.param(value, column);
  }
  if (column.defaultFn) {
    const value = column.defaultFn();
    return is(value, SQL) ? value : sql.param(value, column);
  }
  if (column.default !== undefined) {
    return is(column.default, SQL)
      ? sql`(${column.default})`
      : sql.param(column.default, column);
  }
  return sql`NULL`;
}

/**
 * `condition` が真のときだけ 1 行を挿入する文（INSERT ... SELECT ... WHERE）。
 * INSERT ... SELECT では列の既定値（`$defaultFn`・SQL の既定値）が使われないため、
 * テーブル定義の列の並びどおりに、渡した値か列の既定値を並べる。
 * 挿入されたかは `.returning()` の件数で確かめる
 */
export function insertWhere<TTable extends SQLiteTable>(
  db: Db,
  table: TTable,
  values: Partial<TTable["$inferInsert"]>,
  condition: SQLWrapper | undefined,
) {
  const columns = Object.entries(getTableColumns(table));
  const selected = sql.join(
    columns.map(([key, column]) =>
      columnValue(column, values as Record<string, unknown>, key),
    ),
    sql`, `,
  );
  return db
    .insert(table)
    .select(
      condition == null
        ? sql`SELECT ${selected}`
        : sql`SELECT ${selected} WHERE ${condition}`,
    );
}
