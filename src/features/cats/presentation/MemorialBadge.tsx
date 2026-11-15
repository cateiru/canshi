import { TbFlower } from "react-icons/tb";
import { Badge } from "@/components/ui";
import styles from "./MemorialBadge.module.css";

type MemorialBadgeProps = {
  className?: string;
};

/** メモリー（思い出）へ移した猫に付けるバッジ。ねこ一覧・ねこのページ・AI との接続の設定で使う */
export function MemorialBadge({ className }: MemorialBadgeProps) {
  return (
    <Badge
      color="accent"
      className={[styles.badge, className].filter(Boolean).join(" ")}
    >
      <TbFlower className={styles.icon} aria-hidden="true" />
      メモリー
    </Badge>
  );
}
