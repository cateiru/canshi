import type {
  Cat,
  CatCoatColor,
  CatCoatPattern,
  CatCoatWhiteAmount,
  CatNeuterStatus,
} from "@/db/schema";

export const SEX_LABEL: Record<Cat["sex"], string> = {
  female: "メス",
  male: "オス",
  unknown: "不明",
};

/** 避妊・去勢手術の呼び方。性別で決まるため、性別がわかっていればどちらか一方だけを表示する */
export const NEUTER_TERM: Record<Cat["sex"], string> = {
  female: "避妊",
  male: "去勢",
  unknown: "避妊・去勢",
};

export const NEUTER_STATUS_LABEL: Record<CatNeuterStatus, string> = {
  intact: "未",
  neutered: "済",
};

export const COAT_COLOR_LABEL: Record<CatCoatColor, string> = {
  black: "黒",
  brown: "ブラウン（キジ）",
  silver: "シルバー（サバ）",
  red: "茶（レッド）",
  cream: "クリーム",
  blue: "グレー（ブルー）",
  chocolate: "チョコレート",
  tortoiseshell: "黒×茶（サビ・三毛）",
  blue_cream: "グレー×クリーム",
  white: "白",
};

export const COAT_PATTERN_LABEL: Record<CatCoatPattern, string> = {
  solid: "単色（柄なし）",
  mackerel_tabby: "縞（トラ）",
  classic_tabby: "渦巻き",
  spotted: "斑点（スポッテッド）",
  ticked: "ティックド（細かい霜降り）",
  colorpoint: "ポイント（顔・手足が濃い）",
};

export const COAT_WHITE_LABEL: Record<CatCoatWhiteAmount, string> = {
  none: "なし",
  low: "少し（胸・足先など）",
  medium: "半分くらい（ハチワレなど）",
  high: "ほとんど白",
};

/** 避妊・去勢手術の状況を、性別に合った呼び方と合わせて表示する（例：「去勢：済」）。未設定なら null */
export function formatNeuterStatus(
  sex: Cat["sex"],
  status: CatNeuterStatus | null,
): string | null {
  return status ? `${NEUTER_TERM[sex]}：${NEUTER_STATUS_LABEL[status]}` : null;
}
