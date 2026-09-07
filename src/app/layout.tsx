import type { Metadata } from "next";
import { ToastRegionRoot } from "@/components/ui";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "CANSHI",
  description: "愛猫の記録アプリ",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>
        {children}
        <ToastRegionRoot />
      </body>
    </html>
  );
}
