declare global {
  interface Env {
    // ローカル開発用に `.dev.vars` で設定する値（`.dev.vars.example` 参照）。
    // `.dev.vars` はコミットしないため `wrangler types` では検出できず、ここで型を補う。
    // ホスト名が localhost のときだけ効く（src/auth/access.ts の `isLocalDevBypass`）
    ACCESS_DEV_BYPASS?: string;
  }
}

export {};
