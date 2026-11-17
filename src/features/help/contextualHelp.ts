import { RECORD_HELPS } from "./recordHelps";
import { recordHelpSlug } from "./topics";

const RECORD_TYPES = new Set(RECORD_HELPS.map((record) => record.recordType));

/**
 * 画面のパスから、その画面の使い方を説明するヘルプの記事の slug を返す。
 * 対応する記事がない画面では null を返す（ヘッダーのヘルプのリンクは、ヘルプの一覧へ進める）
 */
export function helpSlugForPath(pathname: string): string | null {
  const [first, second, third, fourth] = pathname.split("/").filter(Boolean);

  switch (first) {
    case "cats":
      if (!second) {
        return "households-and-cats";
      }
      if (second === "new" || third === "edit") {
        return "add-cat";
      }
      if (!third || third === "timeline") {
        return "records";
      }
      if (third === "notification-settings") {
        return "notifications";
      }
      return RECORD_TYPES.has(third) ? recordHelpSlug(third) : "records";
    case "households":
      // 家のねこにまとめてごはんを記録する画面（`/households/<id>/feeding-records/new`）
      return third === "feeding-records"
        ? recordHelpSlug("feeding-records")
        : null;
    case "feeding-presets":
      return "feeding-presets";
    case "food-products":
      return "household-food";
    case "invitations":
      return "create-household";
    case "notifications":
      return "notifications";
    case "oauth":
      return "ai-connections";
    case "settings":
      if (second === "households") {
        return fourth === "feeding-schedules"
          ? "household-food"
          : "create-household";
      }
      if (second === "notifications") {
        return "notifications";
      }
      if (second === "ai-connections") {
        return "ai-connections";
      }
      return null;
    default:
      return null;
  }
}
