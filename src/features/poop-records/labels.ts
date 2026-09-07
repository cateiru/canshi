import type { PoopRecord } from "@/db/schema";

export const CONSISTENCY_LABEL: Record<PoopRecord["consistency"], string> = {
  hard: "硬い",
  normal: "ふつう",
  soft: "柔らかい",
  liquid: "液体",
};
