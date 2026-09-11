// `wrangler types`（`worker-configuration.d.ts`）が生成する `Env` は wrangler.toml の
// バインディング・`[vars]` だけを見ており、`wrangler secret put` や `.dev.vars` で設定する
// 値は含まない。VAPID 鍵（`docs/deploy.md` 参照）はそちらで設定するため、ここで型を補う
interface Env {
  VAPID_SUBJECT?: string;
  NEXT_PUBLIC_VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
}
