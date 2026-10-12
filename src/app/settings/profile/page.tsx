import { permanentRedirect } from "next/navigation";

/** プロフィール設定はアカウント設定へまとめたため、以前の URL を開いたときはプロフィールの編集ページへ移す */
export default function ProfileSettingsPage() {
  permanentRedirect("/settings/account/profile");
}
