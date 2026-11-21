import { Alert, Button, Select } from "@canshi/shared/ui";
import { useState } from "react";
import { useSearchParams } from "react-router";
import type { ChangeResponse } from "../../api/types";
import { USER_ROLES } from "../../models";
import { segment, sendJson } from "../api";
import common from "../common.module.css";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { userRoleLabel } from "../format";
import table from "./table.module.css";

/**
 * ユーザーの詳細（`/users/:userId`）での操作。権限の変更と、すべての端末からログアウトさせる操作は
 * 詳細でだけ行い、一覧（`/users`）は表示だけにする
 */

type UserSummary = { id: string; name: string; role: string };

const ROLE_OPTIONS = USER_ROLES.map((role) => ({
  value: role,
  label: userRoleLabel(role),
}));

/** 操作の結果を表示する、詳細の URL のクエリ */
export type UserChangeResult =
  | { roleChange: "updated" | "update-failed" }
  | { loggedOut: "1" };

/** 権限はアプリ全体の権限で、管理画面に入れるかどうかとは関係しないことの説明 */
export function UserRoleLead() {
  return (
    <p className={common.lead}>
      権限はアプリ全体の権限で、家の中での権限（オーナー・メンバー）とは別です。
      {userRoleLabel("admin")}
      にしても、この管理画面に入れるようにはなりません（管理画面に入れるユーザーは
      Cloudflare Access のポリシーで決まります）。
    </p>
  );
}

/** 直前に行った操作の結果（URL のクエリ `roleChange`・`loggedOut`） */
export function UserChangeNotice(props: { user: UserSummary }) {
  const { user } = props;
  const [searchParams] = useSearchParams();
  const roleChange = searchParams.get("roleChange");
  return (
    <>
      {searchParams.get("loggedOut") === "1" ? (
        <Alert color="success" role="status">
          {user.name} をすべての端末からログアウトさせました。
        </Alert>
      ) : null}
      {roleChange === "updated" ? (
        <Alert color="success" role="status">
          {user.name} の権限を{userRoleLabel(user.role)}にしました。
        </Alert>
      ) : null}
      {roleChange === "update-failed" ? (
        <Alert color="error" role="alert">
          {user.name}{" "}
          の権限を変えられませんでした。選べる権限を選び直してください。
        </Alert>
      ) : null}
    </>
  );
}

/**
 * ユーザーの権限を選んで変えるフォーム。権限を変えたあとに選び直した値を捨てるよう、
 * 使う側で今の権限を `key` にして作り直す
 */
export function UserRoleForm(props: {
  user: UserSummary;
  onChanged: (ok: boolean) => void;
}) {
  const { user } = props;
  const [role, setRole] = useState(user.role);
  const [isPending, setIsPending] = useState(false);
  return (
    <form
      className={common.inlineForm}
      onSubmit={async (event) => {
        event.preventDefault();
        setIsPending(true);
        try {
          const result = await sendJson<ChangeResponse>(
            "POST",
            `/users/${segment(user.id)}/role`,
            { role },
          ).catch(() => ({ ok: false }) as const);
          props.onChanged(result.ok);
        } finally {
          setIsPending(false);
        }
      }}
    >
      {/* 項目名（「権限」）が横にあるため、ラベルは読み上げだけにする */}
      <Select
        label={`${user.name} の権限`}
        options={ROLE_OPTIONS}
        selectedKey={role}
        onSelectionChange={(key) => {
          if (typeof key === "string") {
            setRole(key);
          }
        }}
        className={`${table.compactSelect} ${table.hiddenLabel}`}
      />
      <Button type="submit" variant="secondary" isDisabled={isPending}>
        変更
      </Button>
    </form>
  );
}

/** すべての端末からログアウトさせる前の確認 */
export function LogoutDialog(props: {
  user: { id: string; name: string };
  open: boolean;
  onClose: () => void;
  onLoggedOut: () => void;
}) {
  const { user } = props;
  return (
    <ConfirmDialog
      open={props.open}
      title="すべての端末からログアウトさせる"
      confirmLabel="ログアウトさせる"
      variant="danger"
      onClose={props.onClose}
      onConfirm={async () => {
        await sendJson("DELETE", `/users/${segment(user.id)}/sessions`);
        props.onLoggedOut();
      }}
    >
      <p>{user.name} をすべての端末からログアウトさせますか？</p>
    </ConfirmDialog>
  );
}
