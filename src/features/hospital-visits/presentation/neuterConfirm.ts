/**
 * 避妊・去勢の通院記録を追加したあと、猫のプロフィールの避妊・去勢を「済」にするかを聞くための
 * 通院記録一覧の search。追加フォームが保存後の遷移先に付け、一覧ページが確認のダイアログを開く
 */
export const NEUTER_CONFIRM_PARAM = "confirmNeuter";

/** 通院記録一覧の URL。`confirmNeuter` なら避妊・去勢を「済」にするかを聞く */
export function hospitalVisitsHref(catId: string, confirmNeuter = false) {
  const href = `/cats/${catId}/hospital-visits`;
  return confirmNeuter ? `${href}?${NEUTER_CONFIRM_PARAM}=1` : href;
}
