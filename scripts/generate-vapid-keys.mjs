import { webcrypto } from "node:crypto";

// `@block65/webcrypto-web-push` が期待する形式に合わせる（`src/features/push/vapid.ts` 参照）：
// - 公開鍵：生の EC ポイント（0x04 + X + Y の 65 バイト）を base64url にしたもの
// - 秘密鍵：JWK の `d`（32 バイトのスカラー値）。JWK エクスポートの時点で base64url なのでそのまま使う
const keyPair = await webcrypto.subtle.generateKey(
  { name: "ECDSA", namedCurve: "P-256" },
  true,
  ["sign", "verify"],
);

const publicKeyRaw = await webcrypto.subtle.exportKey("raw", keyPair.publicKey);
const privateKeyJwk = await webcrypto.subtle.exportKey(
  "jwk",
  keyPair.privateKey,
);

const publicKey = Buffer.from(publicKeyRaw).toString("base64url");
const privateKey = privateKeyJwk.d;

console.log(
  "VAPID 鍵ペアを生成しました。以下を .dev.vars（ローカル）や wrangler secret（本番）に設定してください。",
);
console.log(
  "NEXT_PUBLIC_VAPID_PUBLIC_KEY はクライアントに公開されるため .env にも追記が必要です（docs/deploy.md 参照）。",
);
console.log();
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
