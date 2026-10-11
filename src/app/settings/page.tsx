import type { Metadata } from "next";
import { Breadcrumb, NavCard } from "@/components/ui";
import {
  AppearanceSettingsIcon,
  HouseholdIcon,
  LoginSettingsIcon,
  NotificationSettingsIcon,
  ProfileSettingsIcon,
  ReleaseNotesIcon,
} from "@/components/ui/RecordIcons/RecordIcons";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "設定 | CANSHI",
};

const settings = [
  {
    href: "/settings/profile",
    title: "プロフィール設定",
    description: "あなたの名前とアイコンを設定します。",
    icon: ProfileSettingsIcon,
  },
  {
    href: "/settings/login",
    title: "ログイン設定",
    description: "ログイン中のアカウントを確認し、ログアウトします。",
    icon: LoginSettingsIcon,
  },
  {
    href: "/settings/households",
    title: "家の設定",
    description:
      "所属している家の名前やメンバー、ごはん商品・プリセットを管理します。",
    icon: HouseholdIcon,
  },
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
      <p>
        プロフィールやログイン、家、通知、見た目の設定、アプリの更新情報を確認できます。
      </p>

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
