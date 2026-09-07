import type { Symptom } from "@/db/schema";

export const STATUS_LABEL: Record<Symptom["status"], string> = {
  ongoing: "継続中",
  improving: "改善",
  resolved: "解消",
};
