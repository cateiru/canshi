import {
  AiConnectionIcon,
  ApiTokenIcon,
  ExternalConnectionIcon,
} from "@canshi/shared/ui/RecordIcons";
import type { Metadata } from "next";
import { Breadcrumb, NavCard } from "@/components/ui";
import { requireUser } from "@/features/auth/presentation/session";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "外部接続",
};

export const dynamic = "force-dynamic";

const connections = [
  {
    href: "/settings/ai-connections",
    title: "AIとの接続",
    description:
      "ChatGPT などの AI のアプリとの接続を確認し、許可する範囲の変更や解除をします。",
    icon: AiConnectionIcon,
  },
  {
    href: "/settings/api-tokens",
    title: "APIトークン",
    description:
      "自分で作ったプログラムなどから API を使うためのトークンを発行し、管理します。",
    icon: ApiTokenIcon,
  },
];

/** 外部接続（AI との接続・API トークン）の設定への導線 */
export default async function ExternalConnectionsPage() {
  await requireUser();

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/home" },
          { label: "設定", href: "/settings" },
          { label: "外部接続" },
        ]}
      />

      <header className={styles.header}>
        <RecordPageHeading icon={ExternalConnectionIcon}>
          外部接続
        </RecordPageHeading>
        <p className={styles.description}>
          AI
          のアプリや自分で作ったプログラムから、ねこの記録を読み書きできるようにします。
        </p>
      </header>

      <nav aria-label="外部接続のメニュー">
        <ul className={styles.list}>
          {connections.map(({ href, title, description, icon: Icon }) => (
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
