import { Alert, Button, Select } from "@canshi/shared/ui";
import { useState } from "react";
import { useSearchParams } from "react-router";
import type { ChangeResponse } from "../../api/types";
import { segment, sendJson } from "../api";
import common from "../common.module.css";
import { ConfirmDialog } from "../components/ConfirmDialog";
import table from "./table.module.css";

/**
 * 家の詳細（`/households/:householdId`）での、メンバーの追加・削除の操作。操作は詳細でだけ行い、
 * 一覧（`/households`）は表示だけにする
 */

type Named = { id: string; name: string };

/** メンバーの追加・削除の結果（URL のクエリ `memberChange` の値） */
export type MemberChange = "added" | "removed" | "add-failed" | "remove-failed";

/** 家から外すメンバー */
export type MemberRemoval = { userId: string; userName: string };

/** 直前に行ったメンバーの追加・削除の結果（URL のクエリ `memberChange`・`user`） */
export function MemberChangeNotice(props: {
  household: Named;
  /** 全ユーザー（外したユーザーは、もうメンバーにいないため） */
  users: Named[];
}) {
  const { household } = props;
  const [searchParams] = useSearchParams();
  const user = props.users.find((item) => item.id === searchParams.get("user"));
  if (!user) {
    return null;
  }
  switch (searchParams.get("memberChange")) {
    case "added":
      return (
        <Alert color="success" role="status">
          {user.name} を {household.name} のメンバーに追加しました。
        </Alert>
      );
    case "removed":
      return (
        <Alert color="success" role="status">
          {user.name} を {household.name} から外しました。
        </Alert>
      );
    case "add-failed":
      return (
        <Alert color="error" role="alert">
          {user.name} を {household.name}{" "}
          のメンバーに追加できませんでした。すでにメンバーになっていないか確かめてください。
        </Alert>
      );
    case "remove-failed":
      return (
        <Alert color="error" role="alert">
          {user.name} を {household.name}{" "}
          から外せませんでした。オーナーは外せないため、先にメインアプリでオーナーを移譲してください。
        </Alert>
      );
    default:
      return null;
  }
}

/**
 * まだメンバーでないユーザーを選んで、家のメンバーとして追加するフォーム。候補が変わったら
 * 選んでいたユーザーを選び直すよう、使う側で候補の ID を `key` にして作り直す
 */
export function AddMemberForm(props: {
  household: Named;
  candidates: Named[];
  onAdded: (userId: string, ok: boolean) => void;
}) {
  const { household, candidates } = props;
  const [userId, setUserId] = useState(candidates[0].id);
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
            `/households/${segment(household.id)}/members`,
            { userId },
          ).catch(() => ({ ok: false }) as const);
          props.onAdded(userId, result.ok);
        } finally {
          setIsPending(false);
        }
      }}
    >
      <Select
        label="追加するユーザー"
        options={candidates.map((user) => ({
          value: user.id,
          label: `${user.name}（${user.id}）`,
        }))}
        selectedKey={userId}
        onSelectionChange={(key) => {
          if (typeof key === "string") {
            setUserId(key);
          }
        }}
        className={table.compactSelect}
      />
      <Button type="submit" variant="secondary" isDisabled={isPending}>
        メンバーとして追加
      </Button>
    </form>
  );
}

/** メンバーを家から外す前の確認。`removal` が null のあいだは閉じている */
export function RemoveMemberDialog(props: {
  household: Named;
  removal: MemberRemoval | null;
  onClose: () => void;
  onRemoved: (removal: MemberRemoval, ok: boolean) => void;
}) {
  const { household, removal } = props;
  return (
    <ConfirmDialog
      open={removal !== null}
      title="家から外す"
      confirmLabel="外す"
      variant="danger"
      onClose={props.onClose}
      onConfirm={async () => {
        if (!removal) {
          return;
        }
        const path = `/households/${segment(household.id)}/members/${segment(removal.userId)}`;
        const result = await sendJson<ChangeResponse>("DELETE", path).catch(
          () => ({ ok: false }) as const,
        );
        props.onRemoved(removal, result.ok);
      }}
    >
      <p>
        {removal?.userName} を {household.name} から外しますか？
      </p>
    </ConfirmDialog>
  );
}
