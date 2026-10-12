import { permanentRedirect } from "next/navigation";

/** ログイン設定はアカウント設定にまとめたため、以前の URL を開いたときはアカウント設定へ移す */
export default function LoginSettingsPage() {
  permanentRedirect("/settings/account");
}
