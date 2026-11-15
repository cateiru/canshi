import type { Metadata } from "next";
import { getAccessibleCat } from "@/features/auth/presentation/session";
import { getMedicationById } from "../infrastructure/queries";

type MedicationPageMetadataProps = {
  params: Promise<{ catId: string; medicationId: string }>;
};

/**
 * 服薬予定ごとのページ（投薬実績）の `generateMetadata` を作る。title は見出しと同じく薬の名前を含める。
 * 参照できない猫・別の猫の服薬予定なら title を付けない（ページ本体が 404 にする）
 */
export function medicationPageMetadata(
  toTitle: (medicationName: string) => string,
) {
  return async ({ params }: MedicationPageMetadataProps): Promise<Metadata> => {
    const { catId, medicationId } = await params;
    const [cat, medication] = await Promise.all([
      getAccessibleCat(catId),
      getMedicationById(medicationId),
    ]);
    if (!cat || !medication || medication.catId !== catId) {
      return {};
    }
    return { title: toTitle(medication.name) };
  };
}
