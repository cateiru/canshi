import { BirthdayCelebrationPreview } from "./BirthdayCelebrationPreview";
import styles from "./page.module.css";
import { WelcomeModalPreview } from "./WelcomeModalPreview";

/**
 * 条件がそろったときだけ開くモーダル（ウェルカムモーダル・誕生日のお祝い）を、条件に関わらず何度でも
 * 表示する開発用ページ。本番では表示しない（`src/app/dev/layout.tsx`）
 */
export default function ModalsDevPage() {
  return (
    <main className={styles.main}>
      <h1 className={styles.title}>モーダルの確認</h1>
      <p className={styles.description}>
        条件がそろったときだけ開くモーダルを、ボタンからいつでも開けます。Cookie
        や localStorage、ページの移動など、本物の処理は行いません。
      </p>
      <WelcomeModalPreview />
      <BirthdayCelebrationPreview />
    </main>
  );
}
