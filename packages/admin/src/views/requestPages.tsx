import {
  type CatalogFoodProductRequest,
  COMPLETED_REQUEST_LIST_LIMIT,
} from "../db/catalogFoodProductRequests";
import { formatDateTime } from "./format";

/** 直前に行ったリクエストの完了とその結果 */
export interface RequestCompletion {
  result: "completed" | "already-completed";
  request: CatalogFoodProductRequest;
}

function CompletionNotice(props: { completion: RequestCompletion }) {
  const { result, request } = props.completion;
  switch (result) {
    case "completed":
      return (
        <p class="notice" role="status">
          「{request.label}」のリクエストを完了にし、{request.userName}{" "}
          に通知しました。
        </p>
      );
    case "already-completed":
      return (
        <p class="warning" role="alert">
          「{request.label}」のリクエストはすでに完了になっています。
        </p>
      );
  }
}

function RequestTable(props: {
  caption: string;
  requests: CatalogFoodProductRequest[];
  /** 完了にするボタンを表示するか（対応を待っているリクエストの表） */
  isOpen: boolean;
}) {
  return (
    <div class="table-wrap">
      <table>
        <caption class="visually-hidden">{props.caption}</caption>
        <thead>
          <tr>
            <th scope="col">検索条件</th>
            <th scope="col">リクエストしたユーザー</th>
            <th scope="col">リクエストした日時</th>
            {props.isOpen ? (
              <th scope="col">操作</th>
            ) : (
              <th scope="col">完了にした日時</th>
            )}
          </tr>
        </thead>
        <tbody>
          {props.requests.map((request) => (
            <tr>
              <td>
                {request.label}
                <code>{request.id}</code>
              </td>
              <td>{request.userName}</td>
              <td class="nowrap">{formatDateTime(request.createdAt)}</td>
              <td class="nowrap">
                {props.isOpen ? (
                  // 確認文にはリクエストの内容などの入力値を含めない（属性値の中の JS として
                  // 実行されるため、エスケープしてもスクリプトを差し込まれうる）
                  <form
                    method="post"
                    action={`/food-product-requests/${encodeURIComponent(request.id)}/complete`}
                    onsubmit="return confirm('このリクエストを完了にし、リクエストしたユーザーに通知しますか？')"
                  >
                    <button type="submit">完了にする</button>
                  </form>
                ) : request.completedAt ? (
                  formatDateTime(request.completedAt)
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CatalogFoodProductRequestsPage(props: {
  open: CatalogFoodProductRequest[];
  completed: CatalogFoodProductRequest[];
  completion?: RequestCompletion;
}) {
  return (
    <>
      {props.completion && <CompletionNotice completion={props.completion} />}
      <p class="lead">
        ユーザーが共通のごはん商品を検索して見つからなかったときに送ったリクエストです。条件に合う商品を共通のごはん商品に追加してから、完了にしてください。完了にすると、リクエストしたユーザーに通知が届きます。
      </p>
      <h3>対応を待っているリクエスト</h3>
      {props.open.length === 0 ? (
        <p class="empty">対応を待っているリクエストはありません。</p>
      ) : (
        <RequestTable
          caption="対応を待っているリクエスト"
          requests={props.open}
          isOpen
        />
      )}
      <h3>完了にしたリクエスト</h3>
      {props.completed.length === 0 ? (
        <p class="empty">完了にしたリクエストはありません。</p>
      ) : (
        <>
          <p class="lead">
            完了にした日時の新しい順に、{COMPLETED_REQUEST_LIST_LIMIT}
            件まで表示します。
          </p>
          <RequestTable
            caption="完了にしたリクエスト"
            requests={props.completed}
            isOpen={false}
          />
        </>
      )}
    </>
  );
}
