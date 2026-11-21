import { Alert, Button, Select, Table } from "@canshi/shared/ui";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import type {
  ChangeResponse,
  HouseholdJson,
  HouseholdsResponse,
  UserJson,
} from "../../api/types";
import { segment, sendJson } from "../api";
import common from "../common.module.css";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Loadable } from "../components/Loadable";
import { Page } from "../components/Page";
import { formatDateTime, householdRoleLabel } from "../format";
import { useApi } from "../useApi";
import table from "./table.module.css";

/** 直前に行ったメンバーの追加・削除の結果（URL のクエリ `memberChange`・`household`・`user`） */
function MemberChangeNotice(props: {
  households: HouseholdJson[];
  users: UserJson[];
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

/** まだメンバーでないユーザーを選んで、家のメンバーとして追加するフォーム */
function AddMemberForm(props: {
  household: HouseholdJson;
  candidates: UserJson[];
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
        label={`${household.name} に追加するユーザー`}
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
        className={`${table.compactSelect} ${table.hiddenLabel}`}
      />
      <Button type="submit" variant="secondary" isDisabled={isPending}>
        メンバーとして追加
      </Button>
    </form>
  );
}

export function HouseholdsPage() {
  const { state, reload } = useApi<HouseholdsResponse>("/households");
  const navigate = useNavigate();
  const [removal, setRemoval] = useState<{
    household: HouseholdJson;
    userId: string;
    userName: string;
  } | null>(null);

  const showResult = (
    memberChange: string,
    householdId: string,
    userId: string,
  ) => {
    const params = new URLSearchParams({
      memberChange,
      household: householdId,
      user: userId,
    });
    navigate(`/households?${params}`);
    reload();
  };

  return (
    <Page title="家">
      <Loadable state={state} reload={reload}>
        {({ households, users }) =>
          households.length === 0 ? (
            <p className={common.empty}>家はまだありません。</p>
          ) : (
            <>
              <MemberChangeNotice households={households} users={users} />
              <Table>
                <thead>
                  <tr>
                    <th scope="col">名前</th>
                    <th scope="col">メンバー</th>
                    <th scope="col">猫</th>
                    <th scope="col">作成日時</th>
                    <th scope="col">メンバーの追加</th>
                  </tr>
                </thead>
                <tbody>
                  {households.map((household) => {
                    const memberIds = new Set(
                      household.members.map((member) => member.userId),
                    );
                    const candidates = users.filter(
                      (user) => !memberIds.has(user.id),
                    );
                    return (
                      <tr key={household.id}>
                        <th scope="row">
                          <span className={table.name}>{household.name}</span>
                          <code className={common.code}>{household.id}</code>
                        </th>
                        <td>
                          {household.members.length === 0 ? (
                            <span className={common.empty}>なし</span>
                          ) : (
                            <ul className={table.members}>
                              {household.members.map((member) => (
                                <li
                                  key={member.userId}
                                  className={table.member}
                                >
                                  <span>
                                    {member.userName}（
                                    {householdRoleLabel(member.role)}）
                                  </span>
                                  {member.role === "member" ? (
                                    <Button
                                      variant="danger"
                                      onPress={() =>
                                        setRemoval({
                                          household,
                                          userId: member.userId,
                                          userName: member.userName,
                                        })
                                      }
                                    >
                                      家から外す
                                    </Button>
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                        <td className={common.num}>{household.catCount}</td>
                        <td className={common.nowrap}>
                          {formatDateTime(household.createdAt)}
                        </td>
                        <td>
                          {candidates.length === 0 ? (
                            <span className={common.empty}>-</span>
                          ) : (
                            // 候補が変わったら、選んでいたユーザーを選び直す
                            <AddMemberForm
                              key={candidates.map((user) => user.id).join()}
                              household={household}
                              candidates={candidates}
                              onAdded={(userId, ok) =>
                                showResult(
                                  ok ? "added" : "add-failed",
                                  household.id,
                                  userId,
                                )
                              }
                            />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </>
          )
        }
      </Loadable>
      <ConfirmDialog
        open={removal !== null}
        title="家から外す"
        confirmLabel="外す"
        variant="danger"
        onClose={() => setRemoval(null)}
        onConfirm={async () => {
          if (!removal) {
            return;
          }
          const path = `/households/${segment(removal.household.id)}/members/${segment(removal.userId)}`;
          const result = await sendJson<ChangeResponse>("DELETE", path).catch(
            () => ({ ok: false }) as const,
          );
          setRemoval(null);
          showResult(
            result.ok ? "removed" : "remove-failed",
            removal.household.id,
            removal.userId,
          );
        }}
      >
        <p>
          {removal?.userName} を {removal?.household.name} から外しますか？
        </p>
      </ConfirmDialog>
    </Page>
  );
}
