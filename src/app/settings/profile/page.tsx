import { permanentRedirect } from "next/navigation";

/** プロフィール設定はアカウント設定にまとめたため、以前の URL を開いたときはアカウント設定へ移す */
export default function ProfileSettingsPage() {
  permanentRedirect("/settings/account");
}
