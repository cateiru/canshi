import { CAT_COAT_COLORS, CAT_NEUTER_STATUSES, type Cat } from "@/db/schema";
import type { Coat } from "./coat";

const SEXES: readonly Cat["sex"][] = ["male", "female", "unknown"];

/**
 * 入力エラーで戻したときに、選び直さなくて済むようフォームへ返す送信値。
 * 避妊・去勢と毛色の null は「未設定を選んだ」を表し、保存済みの値には戻さない
 */
export type SubmittedCatChoices = Coat &
  Readonly<Pick<Cat, "neuterStatus">> & {
    /** 送信されなかった・値が不正な場合は `undefined` */
    readonly sex?: Cat["sex"];
  };

function pick<T extends string>(
  options: readonly T[],
  value: FormDataEntryValue | null,
): T | undefined {
  return options.find((option) => option === value);
}

export function readSubmittedCatChoices(
  formData: FormData,
): SubmittedCatChoices {
  return {
    sex: pick(SEXES, formData.get("sex")),
    neuterStatus:
      pick(CAT_NEUTER_STATUSES, formData.get("neuterStatus")) ?? null,
    coatColor: pick(CAT_COAT_COLORS, formData.get("coatColor")) ?? null,
  };
}
