import {
  Alert,
  Button,
  Heading,
  Table,
  TableActionCell,
  TableActionHeader,
} from "@canshi/shared/ui";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import type {
  CatalogFoodProductRequestJson,
  CatalogFoodProductRequestsResponse,
  CompleteRequestResponse,
} from "../../api/types";
import { COMPLETED_REQUEST_LIST_LIMIT } from "../../models";
import { segment, sendJson } from "../api";
import common from "../common.module.css";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Loadable } from "../components/Loadable";
import { Page } from "../components/Page";
import { formatDateTime } from "../format";
import { useApi } from "../useApi";
import table from "./table.module.css";

/** 直前に行ったリクエストの完了の結果（URL のクエリ `completion`・`request`） */
function CompletionNotice(props: {
  requests: CatalogFoodProductRequestJson[];
}) {
  const [searchParams] = useSearchParams();
  const request = props.requests.find(
    (item) => item.id === searchParams.get("request"),
  );
  if (!request) {
    return null;
  }
  switch (searchParams.get("completion")) {
    case "completed":
      return (
        <Alert color="success" role="status">
          「{request.label}」のリクエストを完了にし、{request.userName}{" "}
          に通知しました。
        </Alert>
      );
    case "already-completed":
      return (
        <Alert color="error" role="alert">
          「{request.label}」のリクエストはすでに完了になっています。
        </Alert>
      );
    default:
      return null;
  }
}

function RequestTable(props: {
  caption: string;
  requests: CatalogFoodProductRequestJson[];
  /** 完了にするボタンを表示する（対応を待っているリクエストの表）ときに渡す */
  onComplete?: (request: CatalogFoodProductRequestJson) => void;
}) {
  const { onComplete } = props;
  return (
    <Table aria-label={props.caption}>
      <thead>
        <tr>
          <th scope="col">検索条件</th>
          <th scope="col">リクエストしたユーザー</th>
          <th scope="col">リクエストした日時</th>
          {onComplete ? (
            <TableActionHeader />
          ) : (
            <th scope="col">完了にした日時</th>
          )}
        </tr>
      </thead>
      <tbody>
        {props.requests.map((request) => (
          <tr key={request.id}>
            <th scope="row">
              <span className={table.name}>{request.label}</span>
              <code className={common.code}>{request.id}</code>
            </th>
            <td>{request.userName}</td>
            <td className={common.nowrap}>
              {formatDateTime(request.createdAt)}
            </td>
            {onComplete ? (
              <TableActionCell>
                <Button variant="secondary" onPress={() => onComplete(request)}>
                  完了にする
                </Button>
              </TableActionCell>
            ) : (
              <td className={common.nowrap}>
                {request.completedAt
                  ? formatDateTime(request.completedAt)
                  : null}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

export function CatalogFoodProductRequestsPage() {
  const { state, reload } = useApi<CatalogFoodProductRequestsResponse>(
    "/food-product-requests",
  );
  const navigate = useNavigate();
  const [completing, setCompleting] =
    useState<CatalogFoodProductRequestJson | null>(null);

  return (
    <Page title="共通のごはん商品のリクエスト">
      <p className={common.lead}>
        ユーザーが共通のごはん商品を検索して見つからなかったときに送ったリクエストです。条件に合う商品を共通のごはん商品に追加してから、完了にしてください。完了にすると、リクエストしたユーザーに通知が届きます。
      </p>
      <Loadable state={state} reload={reload}>
        {({ open, completed }) => (
          <>
            <CompletionNotice requests={[...open, ...completed]} />
            <Heading level={3}>対応を待っているリクエスト</Heading>
            {open.length === 0 ? (
              <p className={common.empty}>
                対応を待っているリクエストはありません。
              </p>
            ) : (
              <RequestTable
                caption="対応を待っているリクエスト"
                requests={open}
                onComplete={setCompleting}
              />
            )}
            <Heading level={3}>完了にしたリクエスト</Heading>
            {completed.length === 0 ? (
              <p className={common.empty}>完了にしたリクエストはありません。</p>
            ) : (
              <>
                <p className={common.lead}>
                  完了にした日時の新しい順に、{COMPLETED_REQUEST_LIST_LIMIT}
                  件まで表示します。
                </p>
                <RequestTable
                  caption="完了にしたリクエスト"
                  requests={completed}
                />
              </>
            )}
          </>
        )}
      </Loadable>
      <ConfirmDialog
        open={completing !== null}
        title="リクエストを完了にする"
        confirmLabel="完了にする"
        onClose={() => setCompleting(null)}
        onConfirm={async () => {
          if (!completing) {
            return;
          }
          const { result } = await sendJson<CompleteRequestResponse>(
            "POST",
            `/food-product-requests/${segment(completing.id)}/complete`,
          );
          setCompleting(null);
          const params = new URLSearchParams({
            completion: result,
            request: completing.id,
          });
          navigate(`/food-product-requests?${params}`);
          reload();
        }}
      >
        <p>「{completing?.label}」のリクエストを完了にしますか？</p>
        <p>
          完了にすると、リクエストしたユーザーに通知が届きます。取り消せません。
        </p>
      </ConfirmDialog>
    </Page>
  );
}
