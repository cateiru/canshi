import type { VapidKeys } from "@block65/webcrypto-web-push";

export type VapidEnv = {
  VAPID_SUBJECT?: string;
  NEXT_PUBLIC_VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
};

/**
 * VAPID 鍵を環境変数から読む。
 *
 * Next.js のリクエスト処理では `process.env` から読めるが、Cloudflare Workflows の
 * ステップ内（`src/workflows/notification.ts`）はリクエストの外なので `process.env` が
 * 埋まっているとは限らず、`this.env` を明示的に渡す（`src/db/client.ts` の `getDb` と同じ理由）。
 *
 * いずれかが未設定の場合は null を返す（鍵未生成の環境では Push 送信をスキップする）
 */
export function getVapidKeys(env: VapidEnv): VapidKeys | null {
  const subject = env.VAPID_SUBJECT;
  const publicKey = env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = env.VAPID_PRIVATE_KEY;

  if (!subject || !publicKey || !privateKey) {
    return null;
  }

  return { subject, publicKey, privateKey };
}
