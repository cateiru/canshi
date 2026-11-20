import { HelpIcon, ReleaseNotesIcon } from "@canshi/shared/ui/RecordIcons";
import { ButtonLink, NavCard } from "@/components/ui";
import { CatIcon } from "@/features/cats/presentation/CatIcon";
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
          ねこ一覧を見る
        </ButtonLink>
      </section>
      <nav aria-label="ホームメニュー" className={styles.menu}>
        <NavCard
          href="/help"
          icon={HelpIcon}
          title="ヘルプを見る"
          titleAs="h2"
          description="はじめ方や記録のつけ方など、使い方をご案内。"
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
