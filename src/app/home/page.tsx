import Link from "next/link";
import { TbChevronRight, TbNews, TbSettings } from "react-icons/tb";
import { ButtonLink } from "@/components/ui";
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
          <CatIcon aria-hidden="true" size={20} />
          猫一覧を見る
        </ButtonLink>
      </section>
      <nav aria-label="ホームメニュー" className={styles.menu}>
        <Link href="/settings" className={styles.link}>
          <TbSettings className={styles.icon} aria-hidden="true" />
          <div>
            <h2>設定を開く</h2>
            <p>通知やごはんの共通設定をまとめて管理。</p>
          </div>
          <TbChevronRight aria-hidden="true" size={20} />
        </Link>
        <Link href="/release-notes" className={styles.link}>
          <TbNews className={styles.icon} aria-hidden="true" />
          <div>
            <h2>更新情報</h2>
            <p>新しい機能や、使いやすさの改善をご案内。</p>
          </div>
          <TbChevronRight aria-hidden="true" size={20} />
        </Link>
      </nav>
    </main>
  );
}
