import type { Cat, CatCoatColor, CatNeuterStatus } from "@/db/schema";

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

/**
 * ベース色の名前。画面では色見本だけで選ぶため、読み上げ・色見本のツールチップと、
 * 毛色を表示するとき（`formatCoat`）・AI との接続（MCP）で使う
 */
export const COAT_COLOR_LABEL: Record<CatCoatColor, string> = {
  black: "黒",
  brown: "ブラウン",
  silver: "シルバー",
  red: "茶",
  cream: "クリーム",
  blue: "グレー",
  dark_brown: "こげ茶",
  tortoiseshell: "黒と茶",
  blue_cream: "グレーとクリーム",
  white: "白",
};

/** 避妊・去勢手術の状況を、性別に合った呼び方と合わせて表示する（例：「去勢：済」）。未設定なら null */
export function formatNeuterStatus(
  sex: Cat["sex"],
  status: CatNeuterStatus | null,
): string | null {
  return status ? `${NEUTER_TERM[sex]}：${NEUTER_STATUS_LABEL[status]}` : null;
}
