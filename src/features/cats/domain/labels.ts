import type { Cat } from "@/db/schema";

export const SEX_LABEL: Record<Cat["sex"], string> = {
  female: "メス",
  male: "オス",
  unknown: "不明",
};
