// `wrangler types`（`worker-configuration.d.ts`）が生成する `Env` は wrangler.toml の
// バインディング・`[vars]` だけを見ており、`wrangler secret put` や `.dev.vars` で設定する
// 値は含まない。VAPID 鍵・ログイン（OIDC）の設定（`docs/deploy.md` 参照）はそちらで
// 設定するため、ここで型を補う
interface Env {
  VAPID_SUBJECT?: string;
  NEXT_PUBLIC_VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  // ログインに使う Cloudflare Access の SaaS OIDC アプリ（`src/features/auth/oidc.ts`）
  ACCESS_DISCOVERY_URL?: string;
  ACCESS_CLIENT_ID?: string;
  ACCESS_CLIENT_SECRET?: string;
  // メールアドレスをハッシュにするときの SALT（`src/features/auth/emailHash.ts`）
  EMAIL_HASH_SALT?: string;
}
