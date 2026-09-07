import type { WeightRecord } from "@/db/schema";

export const INPUT_METHOD_LABEL: Record<WeightRecord["inputMethod"], string> = {
  auto: "自動算出",
  direct: "直接入力",
};
