import type { Metadata } from "next";
import { Breadcrumb, NavCard } from "@/components/ui";
import {
  AppearanceSettingsIcon,
  FeedingPresetIcon,
  FoodProductIcon,
  NotificationSettingsIcon,
  ReleaseNotesIcon,
} from "@/components/ui/RecordIcons/RecordIcons";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "設定 | CANSHI",
};

const settings = [
  {
    href: "/settings/notifications",
    title: "通知設定",
    description: "この端末での通知と、猫ごとのお知らせを設定します。",
    icon: NotificationSettingsIcon,
  },
  {
    href: "/settings/appearance",
    title: "見た目設定",
    description:
      "この端末でのテーマ（ライト・ダーク・システム）やコントラスト、文字サイズを設定します。",
    icon: AppearanceSettingsIcon,
  },
  {
    href: "/food-products",
    title: "ごはん商品一覧",
    description: "ごはんの記録に使う商品を登録・編集します。",
    icon: FoodProductIcon,
  },
  {
    href: "/feeding-presets",
    title: "ごはんプリセット一覧",
    description: "よく使うごはんの組み合わせと量を登録・編集します。",
    icon: FeedingPresetIcon,
  },
  {
    href: "/release-notes",
    title: "更新情報",
    description: "アプリの新機能や改善内容を確認します。",
    icon: ReleaseNotesIcon,
  },
];

export default function SettingsPage() {
  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[{ label: "トップ", href: "/home" }, { label: "設定" }]}
      />
      <h1>設定</h1>
      <p>通知や見た目、ごはんの共通設定、アプリの更新情報を確認できます。</p>

      <nav aria-label="設定メニュー">
        <ul className={styles.list}>
          {settings.map(({ href, title, description, icon: Icon }) => (
            <li key={href}>
              <NavCard
                href={href}
                icon={Icon}
                title={title}
                titleAs="h2"
                description={description}
              />
            </li>
          ))}
        </ul>
      </nav>
    </main>
  );
}
