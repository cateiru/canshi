import { TbFlag } from "react-icons/tb";
import { Button } from "@/components/ui";
import { ScaledIcon } from "@/components/ui/ScaledIcon/ScaledIcon";
import { getCurrentUser } from "@/features/auth/presentation/session";
import { Surface } from "@/features/shared/Surface";
import { startTourAction } from "./actions";
import styles from "./TourStartCard.module.css";

/**
 * はじめてガイドをはじめる（再開する）カード。ヘルプの一覧に置く。
 * ヘルプはログインしていなくても見られるが、ガイドは登録画面を案内するため、ログイン中だけ出す
 */
export async function TourStartCard() {
  if (!(await getCurrentUser())) {
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
