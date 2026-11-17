import { TourGuide } from "./TourGuide";
import { getTourView } from "./tourState";

/** ガイドの途中のときだけ、はじめてガイドのパネルを出す（レイアウトに置く） */
export async function TourGuideLoader() {
  const view = await getTourView();
  return view ? <TourGuide view={view} /> : null;
}
