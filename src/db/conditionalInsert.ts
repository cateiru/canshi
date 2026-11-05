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
