import { TbEditOff, TbEye } from "react-icons/tb";
import styles from "./McpAccessNotice.module.css";

/** 同意画面と接続設定で、AI のアプリに許可する操作を案内する */
export function McpAccessNotice() {
  return (
    <ul className={styles.notice} aria-label="アプリに許可する操作">
      <li>
        <TbEye size={22} aria-hidden="true" />
        <div>
          <strong>読み取り専用の接続です</strong>
          <p>選んだ猫のプロフィールと記録を読み取れます。</p>
        </div>
      </li>
      <li>
        <TbEditOff size={22} aria-hidden="true" />
        <div>
          <strong>記録の追加・変更はできません</strong>
          <p>アプリから CANSHI の記録を書き換えることはありません。</p>
        </div>
      </li>
    </ul>
  );
}
