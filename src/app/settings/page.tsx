import type { Metadata } from "next";
import Link from "next/link";
import {
  TbBell,
  TbBowl,
  TbChevronRight,
  TbClipboardList,
} from "react-icons/tb";
import { Breadcrumb } from "@/components/ui";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "設定 | CANSHI",
};

const settings = [
  {
    href: "/settings/notifications",
    title: "通知設定",
    description: "通知時刻・タイムゾーンや、この端末での通知を設定します。",
    icon: TbBell,
  },
  {
    href: "/food-products",
    title: "ごはん商品一覧",
    description: "ごはんの記録に使う商品を登録・編集します。",
    icon: TbBowl,
  },
  {
    href: "/feeding-presets",
    title: "ごはんプリセット一覧",
    description: "よく使うごはんの組み合わせと量を登録・編集します。",
    icon: TbClipboardList,
  },
];

export default function SettingsPage() {
  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[{ label: "トップ", href: "/home" }, { label: "設定" }]}
      />
      <h1>設定</h1>
      <p>通知やごはんに関する共通の設定を管理します。</p>

      <nav aria-label="設定メニュー">
        <ul className={styles.list}>
          {settings.map(({ href, title, description, icon: Icon }) => (
            <li key={href}>
              <Link href={href} className={styles.link}>
                <Icon className={styles.icon} aria-hidden="true" />
                <div className={styles.content}>
                  <h2 className={styles.title}>{title}</h2>
                  <p className={styles.description}>{description}</p>
                </div>
                <TbChevronRight className={styles.chevron} aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </main>
  );
}
