/** 避妊・去勢手術の通院とみなす、受診理由に含まれる言葉 */
const NEUTER_VISIT_TERMS = ["去勢", "避妊"] as const;

/**
 * 受診理由が避妊・去勢手術の通院を表しているか。「去勢」「避妊」のどちらかを含めばそうみなす。
 * 通院記録を追加したあとに、猫のプロフィールの避妊・去勢を「済」にするかを聞くために使う
 */
export function isNeuterVisitReason(reason: string): boolean {
  return NEUTER_VISIT_TERMS.some((term) => reason.includes(term));
}
