import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CANSHI",
  description: "愛猫の記録アプリ",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
