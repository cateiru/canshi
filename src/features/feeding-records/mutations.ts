import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  cats,
  feedingRecordItems,
  feedingRecords,
  foodProducts,
  type NewFeedingRecordItem,
  notifications,
} from "@/db/schema";
import { NOTIFY_TIMEZONE } from "@/features/notifications/defaults";
import { getNaiveLocalNow } from "@/features/notifications/rules/localDate";
import { combineDateTimeUtc } from "@/features/shared/datetime";
import {
  calculateEstimatedIntakeG,
  calculateEstimatedKcal,
} from "./calculations";
import type { FeedingRecordFormInput } from "./schema";

/*
 * ごはん記録の保存。画面（`./actions.ts`）と AI との接続（MCP）の両方から使う。
 * 猫を参照できるかは呼び出し側で確かめる。MCP は Durable Object の中で動き
 * `getCloudflareContext()` を使えないため、D1 は引数で受け取る
 */

export type SaveFeedingRecordResult = { id: string } | { error: string };

/** 保存する猫。家は参照できるかを確かめた時点のもの */
type FeedingRecordCat = { id: string; householdId: string | null };

/**
 * 明細の商品は、猫の家の商品に限る。猫が別の家へ引っ越す前の記録を編集するときは、
 * その記録ですでに使っている商品（元の家の商品）も、そのまま残せるよう `keptFoodProductIds` で許可する
 */
async function buildItemsToInsert(
  db: ReturnType<typeof getDb>,
  input: FeedingRecordFormInput,
  householdId: string | null,
  keptFoodProductIds: string[] = [],
): Promise<
  | { error: string }
  | { values: Omit<NewFeedingRecordItem, "feedingRecordId">[] }
> {
  const foodProductIds = [
    ...new Set(input.items.map((item) => item.foodProductId)),
  ];
  const products = await db
    .select()
    .from(foodProducts)
    .where(inArray(foodProducts.id, foodProductIds));
  const productById = new Map(
    products
      .filter(
        (product) =>
          (householdId != null && product.householdId === householdId) ||
          keptFoodProductIds.includes(product.id),
      )
      .map((product) => [product.id, product]),
  );

  if (productById.size !== foodProductIds.length) {
    return { error: "選択された商品が見つかりませんでした" } as const;
  }

  // あいまいモードは量を段階でしか持たないため、摂取量・カロリーは計算しない
  if (input.mode === "approximate") {
    const values = input.items.map((item, index) => ({
      foodProductId: item.foodProductId,
      givenAmountG: null,
      leftoverAmountG: null,
      estimatedIntakeG: null,
      estimatedKcal: null,
      givenAmountLevel: item.givenAmountLevel,
      leftoverLevel: item.leftoverLevel,
      sortOrder: index,
    }));
    return { values } as const;
  }

  const values = input.items.map((item, index) => {
    // biome-ignore lint/style/noNonNullAssertion: 上の size チェックで全件存在を確認済み
    const product = productById.get(item.foodProductId)!;
    const estimatedIntakeG = calculateEstimatedIntakeG(
      item.givenAmountG,
      item.leftoverAmountG,
    );
    return {
      foodProductId: item.foodProductId,
      givenAmountG: item.givenAmountG,
      leftoverAmountG: item.leftoverAmountG,
      estimatedIntakeG,
      estimatedKcal: calculateEstimatedKcal(
        estimatedIntakeG,
        product.kcalPer100g,
      ),
      givenAmountLevel: null,
      leftoverLevel: null,
      sortOrder: index,
    };
  });

  return { values } as const;
}

const HOUSEHOLD_CHANGED_ERROR =
  "猫の家が変わったため保存できませんでした。もう一度やり直してください";

/** INSERT ... SELECT の取得元。猫がまだ `householdId` の家にいるときだけ 1 行を返す */
function catInHouseholdRow(catId: string, householdId: string) {
  return and(eq(cats.id, catId), eq(cats.householdId, householdId));
}

/** 猫がまだ `householdId` の家にいるときだけ真になる条件（UPDATE・DELETE の WHERE に含める） */
function catInHouseholdCondition(catId: string, householdId: string) {
  return sql`EXISTS (
    SELECT 1 FROM ${cats}
    WHERE ${cats.id} = ${catId} AND ${cats.householdId} = ${householdId}
  )`;
}

// 明細の商品は保存前に猫の家の商品か確かめているため、確認と保存の間に猫が別の家へ引っ越すと、
// 元の家の商品が引っ越し先の家の記録に入ってしまう。これを防ぐよう明細は 1 行ずつ
// INSERT ... SELECT にし、猫が確認した時点の家にいるときだけ挿入する。1 行ずつのため D1 の
// バインド上限も超えない。呼び出し側で同じ batch に並べて原子性を保つ。
// INSERT ... SELECT では列の既定値が使われないため ID はここで作り、列はテーブル定義と同じ並びにする
function insertFeedingRecordItems(
  db: ReturnType<typeof getDb>,
  feedingRecordId: string,
  catId: string,
  householdId: string,
  values: Omit<NewFeedingRecordItem, "feedingRecordId">[],
) {
  return values.map((value) =>
    db.insert(feedingRecordItems).select((qb) =>
      qb
        .select({
          id: sql`${crypto.randomUUID()}`.as("id"),
          feedingRecordId: sql`${feedingRecordId}`.as("feeding_record_id"),
          foodProductId: sql`${value.foodProductId}`.as("food_product_id"),
          givenAmountG: sql`${value.givenAmountG ?? null}`.as("given_amount_g"),
          leftoverAmountG: sql`${value.leftoverAmountG ?? null}`.as(
            "leftover_amount_g",
          ),
          estimatedIntakeG: sql`${value.estimatedIntakeG ?? null}`.as(
            "estimated_intake_g",
          ),
          estimatedKcal: sql`${value.estimatedKcal ?? null}`.as(
            "estimated_kcal",
          ),
          givenAmountLevel: sql`${value.givenAmountLevel ?? null}`.as(
            "given_amount_level",
          ),
          leftoverLevel: sql`${value.leftoverLevel ?? null}`.as(
            "leftover_level",
          ),
          sortOrder: sql`${value.sortOrder ?? 0}`.as("sort_order"),
        })
        .from(cats)
        .where(catInHouseholdRow(catId, householdId)),
    ),
  );
}

/**
 * ごはんを記録したら、猫の家の未対応のごはんの時間の通知（時間のお知らせ・記録がないときの
 * リマインダー）はもう対応する必要がないため完了にする文。通知は猫ごとではなく家に 1 件のため、
 * 家のどの猫を記録しても完了にする。呼び出し側で記録の保存と同じ batch に並べる。
 *
 * 先の日時の記録はまだあげていないため完了にせず、空の配列を返す（通知の判定でも数えない）。
 * 発生日時は naive UTC のため、現在時刻もローカル時計の数字の naive UTC にして比べる
 * （`evaluateFeedingSchedule` と同じ）。
 * ごはんの時刻の前後の範囲では絞らない。リマインダーは次の時刻との中間に出ることもあるため、
 * それを見てから記録すると次の時刻の範囲に入り、応えた通知が残ってしまうため
 */
function completeFeedingNotifications(
  db: ReturnType<typeof getDb>,
  catId: string,
  householdId: string,
  occurredAt: Date,
) {
  if (
    occurredAt.getTime() >
    getNaiveLocalNow(new Date(), NOTIFY_TIMEZONE).getTime()
  ) {
    return [];
  }
  return [
    db
      .update(notifications)
      .set({ status: "done", updatedAt: new Date() })
      .where(
        and(
          eq(notifications.householdId, householdId),
          inArray(notifications.kind, ["feeding_time", "feeding_not_recorded"]),
          inArray(notifications.status, ["pending", "snoozed"]),
          catInHouseholdCondition(catId, householdId),
        ),
      ),
  ];
}

/** `timestamp` 列に INSERT ... SELECT で入れる値（UNIX 秒） */
function toUnixSeconds(date: Date) {
  return Math.floor(date.getTime() / 1000);
}

/** 記録を追加する。明細の商品は猫の家の商品に限る */
export async function createFeedingRecord(
  cat: FeedingRecordCat,
  data: FeedingRecordFormInput,
  d1?: D1Database,
): Promise<SaveFeedingRecordResult> {
  const db = getDb(d1);
  const catId = cat.id;
  const householdId = cat.householdId;
  const built = await buildItemsToInsert(db, data, householdId);
  if ("error" in built) {
    return { error: built.error };
  }
  // 家のない猫は商品を選べないため、ここには来ない（型を絞るための確認）
  if (householdId == null) {
    return { error: HOUSEHOLD_CHANGED_ERROR };
  }

  const feedingRecordId = crypto.randomUUID();
  const occurredAt = combineDateTimeUtc(data.occurredDate, data.occurredTime);
  const { mode } = data;

  // 記録も明細と同じく、猫が確認した時点の家にいるときだけ挿入する
  const [created] = await db.batch([
    db
      .insert(feedingRecords)
      .select((qb) =>
        qb
          .select({
            id: sql`${feedingRecordId}`.as("id"),
            catId: cats.id,
            occurredAt: sql`${toUnixSeconds(occurredAt)}`.as("occurred_at"),
            mode: sql`${mode}`.as("mode"),
            createdAt: sql`(unixepoch())`.as("created_at"),
            updatedAt: sql`(unixepoch())`.as("updated_at"),
          })
          .from(cats)
          .where(catInHouseholdRow(catId, householdId)),
      )
      .returning({ id: feedingRecords.id }),
    ...insertFeedingRecordItems(
      db,
      feedingRecordId,
      catId,
      householdId,
      built.values,
    ),
    ...completeFeedingNotifications(db, catId, householdId, occurredAt),
  ]);
  if (created.length === 0) {
    return { error: HOUSEHOLD_CHANGED_ERROR };
  }
  return { id: feedingRecordId };
}

/**
 * 猫の記録を更新する。明細の商品は猫の家の商品に限るが、その記録ですでに使っている商品は残せる
 */
export async function updateFeedingRecord(
  cat: FeedingRecordCat,
  id: string,
  data: FeedingRecordFormInput,
  d1?: D1Database,
): Promise<SaveFeedingRecordResult> {
  const db = getDb(d1);
  const catId = cat.id;
  const [existing] = await db
    .select({ id: feedingRecords.id, occurredAt: feedingRecords.occurredAt })
    .from(feedingRecords)
    .where(and(eq(feedingRecords.id, id), eq(feedingRecords.catId, catId)))
    .limit(1);

  if (!existing) {
    return { error: "記録が見つかりませんでした" };
  }

  const currentItems = await db
    .select({ foodProductId: feedingRecordItems.foodProductId })
    .from(feedingRecordItems)
    .where(eq(feedingRecordItems.feedingRecordId, id));
  const householdId = cat.householdId;
  const built = await buildItemsToInsert(
    db,
    data,
    householdId,
    currentItems.map((item) => item.foodProductId),
  );
  if ("error" in built) {
    return { error: built.error };
  }
  // 参照できる猫は必ず家に所属している（型を絞るための確認）
  if (householdId == null) {
    return { error: HOUSEHOLD_CHANGED_ERROR };
  }

  const occurredAt = combineDateTimeUtc(data.occurredDate, data.occurredTime);

  // 更新・明細の削除と挿入のいずれも、猫が確認した時点の家にいるときだけ行う
  const [updated] = await db.batch([
    db
      .update(feedingRecords)
      .set({ occurredAt, mode: data.mode, updatedAt: new Date() })
      .where(
        and(
          eq(feedingRecords.id, id),
          catInHouseholdCondition(catId, householdId),
        ),
      )
      .returning({ id: feedingRecords.id }),
    db
      .delete(feedingRecordItems)
      .where(
        and(
          eq(feedingRecordItems.feedingRecordId, id),
          catInHouseholdCondition(catId, householdId),
        ),
      ),
    ...insertFeedingRecordItems(db, id, catId, householdId, built.values),
    // 日時を変えたときは、その日時に記録したのと同じく通知を完了にする（先の日時から今以前に
    // 直したときなど）。量などだけを直したときは、過去の記録の修正で今の通知を完了にしないよう
    // 何もしない
    ...(occurredAt.getTime() === existing.occurredAt.getTime()
      ? []
      : completeFeedingNotifications(db, catId, householdId, occurredAt)),
  ]);
  if (updated.length === 0) {
    return { error: HOUSEHOLD_CHANGED_ERROR };
  }
  return { id };
}
