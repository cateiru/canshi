import { TbFlag } from "react-icons/tb";
import { Button } from "@/components/ui";
import { ScaledIcon } from "@/components/ui/ScaledIcon/ScaledIcon";
import { getCurrentUser } from "@/features/auth/presentation/session";
import { Surface } from "@/features/shared/Surface";
import { isTourComplete } from "../domain/tour";
import { startTourAction } from "./actions";
import styles from "./TourStartCard.module.css";
import { loadTourProgress } from "./tourState";

/**
 * はじめてガイドをはじめる（再開する）カード。ヘルプの一覧に置く。
 * ヘルプはログインしていなくても見られるが、ガイドは登録画面を案内するため、ログイン中だけ出す。
 * すべてのステップの登録が済んだら、案内することがないため出さない
 */
export async function TourStartCard() {
  const user = await getCurrentUser();
  if (!user) {
    return null;
  }
  const { progress } = await loadTourProgress(user.id);
  if (isTourComplete(progress)) {
    return null;
  }

  return (
    <Surface
      title="はじめてガイド"
      titleId="tour-start-heading"
      icon={<ScaledIcon icon={TbFlag} aria-hidden="true" size={20} />}
      gap="sm"
    >
      <p>
        家の作成から、ねこ・ごはん・ごはんの時間とプリセットの登録までを、順番にご案内します。
        途中でやめても、ここからいつでも続きを再開できます。
      </p>
      <form action={startTourAction} className={styles.actions}>
        <Button type="submit" variant="primary">
          ガイドをはじめる
        </Button>
      </form>
    </Surface>
  );
}
