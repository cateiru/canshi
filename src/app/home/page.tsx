import { ButtonLink } from "@/components/ui";
import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.main}>
      <h1>CANSHI</h1>
      <p>愛猫の記録アプリ</p>
      <ButtonLink href="/cats" variant="primary">
        猫一覧を見る
      </ButtonLink>
      <ButtonLink href="/settings" variant="secondary">
        設定を開く
      </ButtonLink>
      <ButtonLink href="/release-notes" variant="secondary">
        更新情報を見る
      </ButtonLink>
    </main>
  );
}
