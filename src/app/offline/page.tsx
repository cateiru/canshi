import type { Metadata } from "next";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "オフライン | CANSHI",
};

export default function OfflinePage() {
  return (
    <main className={styles.main}>
      <h1>オフラインです</h1>
      <p>
        インターネットに接続されていないため、ページを表示できません。
        <br />
        接続を確認してから、もう一度お試しください。
      </p>
    </main>
  );
}
