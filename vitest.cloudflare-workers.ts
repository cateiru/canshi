// Vitest（Node.js）で `cloudflare:workers` の代わりに読み込むモジュール（`vitest.config.ts` の alias）。
// `cloudflare:workers` は Workers のランタイムにしか無く、Node.js では解決できない。
// バインディングを使うテストは `vi.mock("cloudflare:workers", () => ({ env: { ... } }))` で
// 必要なものだけを渡す
export const env = {} as Env;

export function waitUntil(_promise: Promise<unknown>) {}

export class WorkerEntrypoint {}

export class WorkflowEntrypoint {}

export class DurableObject {}
