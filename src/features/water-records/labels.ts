import type { WaterRecord } from "@/db/schema";

export const MEASUREMENT_METHOD_LABEL: Record<
  WaterRecord["measurementMethod"],
  string
> = {
  measuring_cup: "計量カップ",
  scale: "秤",
  visual: "目視",
};

export const SUBJECTIVE_AMOUNT_LABEL: Record<
  NonNullable<WaterRecord["subjectiveAmount"]>,
  string
> = {
  more: "多い",
  usual: "いつも通り",
  less: "少ない",
};
