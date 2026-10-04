import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui";
import { loginAction } from "@/features/auth/actions";
import { sanitizeCallbackUrl } from "@/features/auth/callbackUrl";
import { getCurrentUser } from "@/features/auth/session";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "ログイン | CANSHI",
};

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams: Promise<{ callbackUrl?: string | string[] }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { callbackUrl: rawCallbackUrl } = await searchParams;
  const callbackUrl = sanitizeCallbackUrl(rawCallbackUrl);

  if (await getCurrentUser()) {
    redirect(callbackUrl);
  }

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
        <form action={loginAction} className={styles.form}>
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          <Button type="submit" variant="primary" className={styles.button}>
            ログイン
          </Button>
        </form>
      </section>
    </main>
  );
}
