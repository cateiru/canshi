import type { BrushingShedAmount } from "@/db/schema";

export const SHED_AMOUNT_LABEL: Record<BrushingShedAmount, string> = {
  less: "少ない",
  usual: "いつも通り",
  more: "多い",
};
