import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { TbSettings } from "react-icons/tb";
import { ButtonLink, Footer, ToastRegionRoot } from "@/components/ui";
import { NotificationBadge } from "@/features/notifications/NotificationBadge";
import { ServiceWorkerRegistration } from "@/features/pwa/ServiceWorkerRegistration";
import "@/styles/globals.css";
import styles from "./layout.module.css";

// NotificationBadge が getCloudflareContext() を使うため静的プリレンダリングできない
export const dynamic = "force-dynamic";

const metadata: Metadata = {
  title: "CANSHI",
  description: "愛猫の記録アプリ",
  openGraph: {
    title: "CANSHI",
    description: "愛猫の記録アプリ",
    siteName: "CANSHI",
    locale: "ja_JP",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
  appleWebApp: {
    capable: true,
    title: "CANSHI",
    statusBarStyle: "default",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
  other: {
    // Next.js の appleWebApp は `mobile-web-app-capable` のみを出力するが、
    // 古い iOS Safari は `apple-mobile-web-app-capable` のみを認識するため明示的に追加する
    "apple-mobile-web-app-capable": "yes",
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") === "http" ? "http" : "https";

  return {
    ...metadata,
    // 固定の公開 URL を持たず、アクセス先のドメインで OG 画像の URL を解決する。
    metadataBase: new URL(`${protocol}://${host}`),
  };
}

export const viewport: Viewport = {
  themeColor: "#ec995a",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>
        <header className={styles.header}>
          <NotificationBadge className={styles.iconLink} />
          <ButtonLink
            href="/settings"
            variant="secondary"
            className={styles.iconLink}
            aria-label="設定"
            title="設定"
          >
            <TbSettings aria-hidden="true" size={20} />
          </ButtonLink>
        </header>
        <div className={styles.content}>{children}</div>
        <Footer />
        <ToastRegionRoot />
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
