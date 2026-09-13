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
      <ButtonLink href="/food-products" variant="secondary">
        ごはん商品一覧を見る
      </ButtonLink>
      <ButtonLink href="/feeding-presets" variant="secondary">
        ごはんプリセット一覧を見る
      </ButtonLink>
      <ButtonLink href="/settings/notifications" variant="secondary">
        通知設定を開く
      </ButtonLink>
      <ButtonLink href="/release-notes" variant="secondary">
        更新情報を見る
      </ButtonLink>
    </main>
  );
}
