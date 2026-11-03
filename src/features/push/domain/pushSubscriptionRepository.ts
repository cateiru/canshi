import type { PushSubscriptionKeys } from "./pushSubscription";

/** テスト通知の予約の結果 */
export type RequestTestPushResult =
  | { outcome: "requested" }
  | { outcome: "not-subscribed" };

/**
 * Push 購読の保存先。実装は `../infrastructure/pushSubscriptionRepository.ts`
 */
export interface PushSubscriptionRepository {
  /**
   * 端末の購読を、ユーザーの購読として保存する。同じ端末（endpoint）で別のユーザーが
   * 購読し直した場合は、そのユーザーの購読にし、送信の失敗回数を戻す
   */
  saveForUser(userId: string, keys: PushSubscriptionKeys): Promise<void>;
  /** ユーザーの購読（とユーザーに紐付く前の購読）だけを削除する */
  removeForUser(userId: string, endpoint: string): Promise<void>;
  /** ユーザーの購読（`endpoint`）へのテスト通知を予約する。別のユーザーの購読には予約できない */
  requestTestPush(
    userId: string,
    endpoint: string,
  ): Promise<RequestTestPushResult>;
}
