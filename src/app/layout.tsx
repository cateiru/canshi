import type { Metadata, Viewport } from "next";
import { ToastRegionRoot } from "@/components/ui";
import { ServiceWorkerRegistration } from "@/features/pwa/ServiceWorkerRegistration";
import "@/styles/globals.css";

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
        {children}
        <ToastRegionRoot />
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
