import type { HospitalVisit } from "@/db/schema";
import { splitDateTimeUtc } from "@/features/shared/datetime";

export function hospitalVisitOptionLabel(hospitalVisit: HospitalVisit): string {
  const { date } = splitDateTimeUtc(hospitalVisit.visitedAt);
  return `${date} ${hospitalVisit.reason}`;
}
