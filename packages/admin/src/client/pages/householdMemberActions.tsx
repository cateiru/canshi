import { Alert, Button, Select } from "@canshi/shared/ui";
import { useState } from "react";
import { useSearchParams } from "react-router";
import type { ChangeResponse } from "../../api/types";
import { segment, sendJson } from "../api";
import common from "../common.module.css";
import { ConfirmDialog } from "../components/ConfirmDialog";
import table from "./table.module.css";

/**
 * 家の一覧（`/households`）と詳細（`/households/:householdId`）で共通の、
 * メンバーの追加・削除の操作
 */

type Named = { id: string; name: string };

/** 家から外すメンバー */
export type MemberRemoval = {
  household: Named;
  userId: string;
  userName: string;
};

/** 直前に行ったメンバーの追加・削除の結果（URL のクエリ `memberChange`・`household`・`user`） */
export function MemberChangeNotice(props: {
  households: Named[];
  users: Named[];
}) {
  const [searchParams] = useSearchParams();
  const household = props.households.find(
    (item) => item.id === searchParams.get("household"),
  );
  const user = props.users.find((item) => item.id === searchParams.get("user"));
  if (!household || !user) {
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

/** まだメンバーでないユーザー（`users` のうち `memberIds` にないもの） */
export function memberCandidates(users: Named[], memberIds: string[]) {
  const ids = new Set(memberIds);
  return users.filter((user) => !ids.has(user.id));
}

/**
 * まだメンバーでないユーザーを選んで、家のメンバーとして追加するフォーム。候補が変わったら
 * 選んでいたユーザーを選び直すよう、使う側で候補の ID を `key` にして作り直す
 */
export function AddMemberForm(props: {
  household: Named;
  candidates: Named[];
  /** 入力欄のラベルを表示する（表の中では列名で分かるため、読み上げだけにする） */
  showLabel?: boolean;
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
        label={
          props.showLabel
            ? "追加するユーザー"
            : `${household.name} に追加するユーザー`
        }
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
        className={
          props.showLabel
            ? table.compactSelect
            : `${table.compactSelect} ${table.hiddenLabel}`
        }
      />
      <Button type="submit" variant="secondary" isDisabled={isPending}>
        メンバーとして追加
      </Button>
    </form>
  );
}

/** メンバーを家から外す前の確認。`removal` が null のあいだは閉じている */
export function RemoveMemberDialog(props: {
  removal: MemberRemoval | null;
  onClose: () => void;
  onRemoved: (removal: MemberRemoval, ok: boolean) => void;
}) {
  const { removal } = props;
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
        const path = `/households/${segment(removal.household.id)}/members/${segment(removal.userId)}`;
        const result = await sendJson<ChangeResponse>("DELETE", path).catch(
          () => ({ ok: false }) as const,
        );
        props.onRemoved(removal, result.ok);
      }}
    >
      <p>
        {removal?.userName} を {removal?.household.name} から外しますか？
      </p>
    </ConfirmDialog>
  );
}
