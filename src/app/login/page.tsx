import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Alert, Button, FormField } from "@/components/ui";
import { developmentLoginAction } from "@/features/auth/actions";
import { sanitizeCallbackUrl } from "@/features/auth/callbackUrl";
import {
  DEVELOPMENT_LOGIN_EMAIL,
  isDevelopmentLoginEnabled,
} from "@/features/auth/developmentLogin";
import { getCurrentUser } from "@/features/auth/session";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "ログイン | CANSHI",
};

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams: Promise<{
    callbackUrl?: string | string[];
    error?: string | string[];
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { callbackUrl: rawCallbackUrl, error } = await searchParams;
  const callbackUrl = sanitizeCallbackUrl(rawCallbackUrl);

  if (await getCurrentUser()) {
    redirect(callbackUrl);
  }

  const { env } = getCloudflareContext();
  const developmentLogin = isDevelopmentLoginEnabled(env);

  return (
    <main className={styles.main}>
      <section className={styles.welcome}>
        <img
          src="/icons/icon.svg"
          className={styles.logo}
          width={64}
          height={64}
          alt=""
        />
        <h1 className={styles.brand}>CANSHI</h1>
        <p className={styles.description}>
          記録を見るにはログインしてください。
        </p>
        {error ? (
          <Alert color="error" className={styles.alert}>
            ログインできませんでした。もう一度お試しください。
          </Alert>
        ) : null}
        {developmentLogin ? (
          // 開発環境（`next dev`）では Cloudflare Access を通さず、メールアドレスだけでログインする
          <form action={developmentLoginAction} className={styles.form}>
            <input type="hidden" name="callbackUrl" value={callbackUrl} />
            <FormField
              label="メールアドレス（開発用）"
              className={styles.field}
              name="email"
              type="email"
              defaultValue={DEVELOPMENT_LOGIN_EMAIL}
              isRequired
            />
            <Button type="submit" variant="primary" className={styles.button}>
              ログイン
            </Button>
          </form>
        ) : (
          <form action="/login/start" method="get" className={styles.form}>
            <input type="hidden" name="callbackUrl" value={callbackUrl} />
            <Button type="submit" variant="primary" className={styles.button}>
              ログイン
            </Button>
          </form>
        )}
      </section>
    </main>
  );
}
