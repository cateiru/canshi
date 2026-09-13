import type { Metadata, Viewport } from "next";
import { Footer, ToastRegionRoot } from "@/components/ui";
import { NotificationBadge } from "@/features/notifications/NotificationBadge";
import { ServiceWorkerRegistration } from "@/features/pwa/ServiceWorkerRegistration";
import "@/styles/globals.css";
import styles from "./layout.module.css";

// NotificationBadge が getCloudflareContext() を使うため静的プリレンダリングできない
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "CANSHI",
  description: "愛猫の記録アプリ",
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
          <NotificationBadge />
        </header>
        {children}
        <Footer />
        <ToastRegionRoot />
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
