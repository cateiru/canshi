import type { AdminBucket } from "../db/catalogFoodProducts";

/**
 * テスト用の R2 バケット。`src/db/catalogFoodProducts.ts` が使う範囲（`put`・`get`・`delete`）だけを
 * メモリ上の Map で再現する。`failDelete` を立てると delete が失敗する
 */
export function createFakeBucket() {
  const objects = new Map<string, { body: Uint8Array; contentType?: string }>();
  const state = { failDelete: false };
  const bucket = {
    async put(
      key: string,
      value: Uint8Array,
      options?: { httpMetadata?: { contentType?: string } },
    ) {
      objects.set(key, {
        body: new Uint8Array(value),
        contentType: options?.httpMetadata?.contentType,
      });
      return {};
    },
    async get(key: string) {
      const object = objects.get(key);
      return object
        ? { body: new Blob([object.body]).stream(), size: object.body.length }
        : null;
    },
    async delete(keys: string | string[]) {
      if (state.failDelete) {
        throw new Error("R2 の削除に失敗しました");
      }
      for (const key of Array.isArray(keys) ? keys : [keys]) {
        objects.delete(key);
      }
    },
  };
  return {
    bucket: bucket as unknown as AdminBucket & R2Bucket,
    objects,
    state,
  };
}
