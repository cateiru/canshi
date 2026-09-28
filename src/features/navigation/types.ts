/**
 * 送信に成功したときに遷移先を返す Server Action の結果。
 * Server Action で `redirect()` すると作成・編集ページが履歴に残るため、
 * 遷移はクライアント側（`useNavigateAfterSubmit`）で行う
 */
export type SubmitRedirect = {
  redirectTo?: string;
};
