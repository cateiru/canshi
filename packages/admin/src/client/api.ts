/**
 * 管理画面の API（`/api/*`、src/app.ts）を呼ぶ。応答の型は src/api/types.ts を参照
 */

/** API が成功以外の状態を返したときのエラー。`body` は応答の JSON（読めなければ null） */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(
      typeof body === "object" &&
        body !== null &&
        "error" in body &&
        typeof body.error === "string"
        ? body.error
        : `通信に失敗しました（${status}）`,
    );
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: { Accept: "application/json", ...init.headers },
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(response.status, body);
  }
  return body as T;
}

export function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  return request<T>(path, { signal });
}

/** JSON を送る書き込み。本文がなければ省く */
export function sendJson<T>(
  method: "POST" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
): Promise<T> {
  return request<T>(path, {
    method,
    ...(body === undefined
      ? {}
      : {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
  });
}

/** フォームの内容（画像を含む）を multipart/form-data で送る */
export function sendForm<T>(
  method: "POST" | "PUT",
  path: string,
  body: FormData,
): Promise<T> {
  return request<T>(path, { method, body });
}

/** URL のパスの 1 区切りに埋め込む ID */
export function segment(id: string) {
  return encodeURIComponent(id);
}
