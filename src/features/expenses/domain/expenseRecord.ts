import type { ExpenseRecord } from "@/db/schema";
import {
  combineDateTimeUtc,
  splitDateTimeUtc,
} from "@/features/shared/datetime";
import type { ExpenseFormFieldErrors, ExpenseFormInput } from "./schema";

/**
 * 支出記録（エンティティ）。家（`householdId`）に属し、関連する猫・通院記録を持つ
 */
export type { ExpenseRecord };

/** 支出記録の中身。ID・家・作成日時を除いたもの */
export type ExpenseRecordContent = Pick<
  ExpenseRecord,
  "spentAt" | "amountYen" | "category" | "memo"
>;

/** 支出記録に紐付ける猫・通院記録 */
export type ExpenseLinks = { catIds: string[]; hospitalVisitIds: string[] };

/** 支出記録に紐付けようとしている通院記録 */
export type HospitalVisitLinkCandidate = {
  catId: string;
  visitedAt: Date;
  /** すでに紐付いている支出記録。なければ null */
  expenseRecordId: string | null;
};

/** 入力から支出記録の中身を作る */
export function toExpenseRecordContent(
  data: ExpenseFormInput,
): ExpenseRecordContent {
  return {
    // 支出は日付だけを入力するため、時刻は 00:00（UTC）で固定する
    spentAt: combineDateTimeUtc(data.spentDate, "00:00"),
    amountYen: data.amountYen,
    category: data.category,
    memo: data.memo ?? null,
  };
}

/** 通院記録を紐付けられるのはカテゴリ「病院」のときだけで、それ以外のカテゴリでは紐付けを外す */
export function hospitalVisitIdsToLink(data: ExpenseFormInput): string[] {
  return data.category === "hospital" ? data.hospitalVisitIds : [];
}

export type ResolvedExpenseLinks =
  | ({ ok: true } & ExpenseLinks)
  | { ok: false; fieldErrors: ExpenseFormFieldErrors };

/**
 * 紐付ける通院記録と関連する猫を確定する。通院記録は支出日と同じ日のもので、
 * 他の支出記録に紐付いていないものに限る。通院した猫は関連する猫にも含める。
 * `candidates` は `hospitalVisitIds` のうち支出の家の猫の通院記録（見つからないものは含まない）
 */
export function resolveExpenseLinks(
  data: ExpenseFormInput,
  expenseId: string | null,
  hospitalVisitIds: string[],
  candidates: HospitalVisitLinkCandidate[],
): ResolvedExpenseLinks {
  if (candidates.length !== hospitalVisitIds.length) {
    return {
      ok: false,
      fieldErrors: {
        hospitalVisitIds: [
          "通院記録が見つかりませんでした。選び直してください",
        ],
      },
    };
  }
  const visitCatIds: string[] = [];
  for (const candidate of candidates) {
    // すでにこの支出に紐付いている通院記録は、共有中に受診日が変わって日付がずれていることがあるため
    // そのまま残せるようにする
    const alreadyLinked =
      expenseId != null && candidate.expenseRecordId === expenseId;
    if (
      !alreadyLinked &&
      splitDateTimeUtc(candidate.visitedAt).date !== data.spentDate
    ) {
      return {
        ok: false,
        fieldErrors: {
          hospitalVisitIds: [
            "支出日と同じ日の通院記録だけを紐付けられます。選び直してください",
          ],
        },
      };
    }
    if (
      candidate.expenseRecordId != null &&
      candidate.expenseRecordId !== expenseId
    ) {
      return {
        ok: false,
        fieldErrors: {
          hospitalVisitIds: [
            "ほかの支出記録に紐付いている通院記録があります。選び直してください",
          ],
        },
      };
    }
    visitCatIds.push(candidate.catId);
  }
  return {
    ok: true,
    catIds: [...new Set([...data.catIds, ...visitCatIds])],
    hospitalVisitIds,
  };
}

/**
 * 通院記録の作成時に紐付ける既存の支出記録として使えるか。受診日と同じ日の、
 * カテゴリ「病院」の支出記録に限る
 */
export function isLinkableToHospitalVisit(
  expense: Pick<ExpenseRecord, "category" | "spentAt">,
  visitedDate: string,
): boolean {
  return (
    expense.category === "hospital" &&
    splitDateTimeUtc(expense.spentAt).date === visitedDate
  );
}
