import { ButtonLink, NavCard } from "@/components/ui";
import {
  ReleaseNotesIcon,
  SettingsIcon,
} from "@/components/ui/RecordIcons/RecordIcons";
import { CatIcon } from "@/features/cats/CatIcon";
import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.main}>
      <section className={styles.welcome}>
        <img
          src="/icons/icon.svg"
          className={styles.logo}
          width={64}
          height={64}
          alt=""
        />
        <h1 className={styles.brand}>CANSHI</h1>
        <h2>愛猫との毎日を、記録に。</h2>
        <p className={styles.description}>
          ごはんや体調、お手入れのこと。
          <br />
          日々の小さな変化を残していきましょう。
        </p>
        <ButtonLink href="/cats" variant="primary">
          <CatIcon aria-hidden="true" size={24} monochrome />
          猫一覧を見る
        </ButtonLink>
      </section>
      <nav aria-label="ホームメニュー" className={styles.menu}>
        <NavCard
          href="/settings"
          icon={SettingsIcon}
          title="設定を開く"
          titleAs="h2"
          description="通知やごはんの共通設定をまとめて管理。"
        />
        <NavCard
          href="/release-notes"
          icon={ReleaseNotesIcon}
          title="更新情報"
          titleAs="h2"
          description="新しい機能や、使いやすさの改善をご案内。"
        />
      </nav>
    </main>
  );
}
