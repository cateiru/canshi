import type { ReactNode } from "react";
import { TbFlower } from "react-icons/tb";
import { ScaledIcon } from "@/components/ui/ScaledIcon/ScaledIcon";
import styles from "./MemorialNotice.module.css";

type MemorialNoticeProps = {
  children: ReactNode;
  className?: string;
};

/**
 * メモリー（思い出）へ移した猫のページに出す案内。強い色の警告ではなく、
 * メモリーの色の枠で穏やかに伝える
 */
export function MemorialNotice({ children, className }: MemorialNoticeProps) {
  return (
    <section
      aria-label="メモリー"
      className={[styles.notice, className].filter(Boolean).join(" ")}
    >
      <ScaledIcon
        icon={TbFlower}
        className={styles.icon}
        size={20}
        aria-hidden="true"
      />
      <div className={styles.body}>{children}</div>
    </section>
  );
}
