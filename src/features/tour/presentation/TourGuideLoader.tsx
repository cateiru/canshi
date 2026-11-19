import { TourGuide } from "./TourGuide";
import { getTourView, isWelcomePending } from "./tourState";
import { WelcomeModal } from "./WelcomeModal";

/**
 * はじめてログインした直後はウェルカムモーダルを、ガイドの途中のときははじめてガイドのパネルを出す
 * （レイアウトに置く）
 */
export async function TourGuideLoader() {
  if (await isWelcomePending()) {
    return <WelcomeModal />;
  }
  const view = await getTourView();
  return view ? <TourGuide view={view} /> : null;
}
