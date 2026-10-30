import { TbEye, TbPencil } from "react-icons/tb";
import styles from "./McpAccessNotice.module.css";

/** 同意画面と接続設定で、AI のアプリに許可する操作を案内する */
export function McpAccessNotice() {
  return (
    <ul className={styles.notice} aria-label="アプリに許可する操作">
      <li>
        <TbEye size={22} aria-hidden="true" />
        <p>選んだ家・猫のプロフィールと記録を読み取れます。</p>
      </li>
      <li>
        <TbPencil size={22} aria-hidden="true" />
        <p>
          「書く」を許可した記録だけを追加・編集できます。記録の削除はできません。
        </p>
      </li>
    </ul>
  );
}
