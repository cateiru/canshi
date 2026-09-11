/** この回数だけ連続で送信に失敗した購読は削除する */
export const MAX_PUSH_FAILURE_COUNT = 5;

/**
 * Push メッセージの TTL（秒）。プッシュサービスは端末がオフラインの間もこの秒数だけ
 * メッセージを保持し、再接続時に配信する。次回のスケジュール実行（15 分間隔）を
 * 何度か跨いでも再送されるよう、余裕を持って 1 日分を設定する
 */
export const PUSH_MESSAGE_TTL_SECONDS = 60 * 60 * 24;
