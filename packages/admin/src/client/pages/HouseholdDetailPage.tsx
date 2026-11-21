import {
  Button,
  Table,
  TableActionCell,
  TableActionHeader,
} from "@canshi/shared/ui";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import type {
  HouseholdDetailJson,
  HouseholdDetailResponse,
} from "../../api/types";
import { ApiError } from "../api";
import common from "../common.module.css";
import { DetailFacts, DetailSection } from "../components/DetailSection";
import { Loadable } from "../components/Loadable";
import { Page } from "../components/Page";
import {
  formatBirthDate,
  formatDateTime,
  householdRoleLabel,
  invitationStatusLabel,
  sexLabel,
} from "../format";
import { householdPath, userPath } from "../paths";
import { RouterLink } from "../RouterLink";
import { useApi } from "../useApi";
import {
  AddMemberForm,
  MemberChangeNotice,
  type MemberRemoval,
  memberCandidates,
  RemoveMemberDialog,
} from "./householdMemberActions";
import { NotFoundPage } from "./NotFoundPage";

const HOUSEHOLDS_BREADCRUMB_ROOT = { label: "家", href: "/households" };

function UserLink(props: { id: string; name: string }) {
  return (
    <RouterLink href={userPath(props.id)} className={common.link}>
      {props.name}
    </RouterLink>
  );
}

function MembersSection(props: {
  household: HouseholdDetailJson;
  users: HouseholdDetailResponse["users"];
  onAdded: (userId: string, ok: boolean) => void;
  onRemove: (removal: MemberRemoval) => void;
}) {
  const { household } = props;
  const candidates = memberCandidates(
    props.users,
    household.members.map((member) => member.userId),
  );
  return (
    <DetailSection title="メンバー">
      {household.members.length === 0 ? (
        <p className={common.empty}>メンバーはいません。</p>
      ) : (
        <Table>
          <thead>
            <tr>
              <th scope="col">名前</th>
              <th scope="col">家での権限</th>
              <th scope="col">参加日時</th>
              <TableActionHeader />
            </tr>
          </thead>
          <tbody>
            {household.members.map((member) => (
              <tr key={member.userId}>
                <th scope="row">
                  <UserLink id={member.userId} name={member.userName} />
                  <code className={common.code}>{member.userId}</code>
                </th>
                <td className={common.nowrap}>
                  {householdRoleLabel(member.role)}
                </td>
                <td className={common.nowrap}>
                  {formatDateTime(member.joinedAt)}
                </td>
                <TableActionCell>
                  {member.role === "member" ? (
                    <Button
                      variant="danger"
                      onPress={() =>
                        props.onRemove({
                          household,
                          userId: member.userId,
                          userName: member.userName,
                        })
                      }
                    >
                      家から外す
                    </Button>
                  ) : null}
                </TableActionCell>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {candidates.length === 0 ? null : (
        // 候補が変わったら、選んでいたユーザーを選び直す
        <AddMemberForm
          key={candidates.map((user) => user.id).join()}
          household={household}
          candidates={candidates}
          showLabel
          onAdded={props.onAdded}
        />
      )}
    </DetailSection>
  );
}

function CatsSection(props: { household: HouseholdDetailJson }) {
  const { cats } = props.household;
  return (
    <DetailSection title="猫">
      {cats.length === 0 ? (
        <p className={common.empty}>猫はまだいません。</p>
      ) : (
        <Table>
          <thead>
            <tr>
              <th scope="col">名前</th>
              <th scope="col">性別</th>
              <th scope="col">生年月日</th>
              <th scope="col">メモリーへ移した日</th>
              <th scope="col">登録日時</th>
            </tr>
          </thead>
          <tbody>
            {cats.map((cat) => (
              <tr key={cat.id}>
                <th scope="row">
                  {cat.name}
                  <code className={common.code}>{cat.id}</code>
                </th>
                <td className={common.nowrap}>{sexLabel(cat.sex)}</td>
                <td className={common.nowrap}>
                  {cat.birthDate ? (
                    formatBirthDate(cat.birthDate, cat.birthDatePrecision)
                  ) : (
                    <span className={common.empty}>-</span>
                  )}
                </td>
                <td className={common.nowrap}>
                  {cat.memorialDate ?? <span className={common.empty}>-</span>}
                </td>
                <td className={common.nowrap}>
                  {formatDateTime(cat.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </DetailSection>
  );
}

function InvitationsSection(props: { household: HouseholdDetailJson }) {
  const { invitations } = props.household;
  return (
    <DetailSection title="招待">
      {invitations.length === 0 ? (
        <p className={common.empty}>招待はありません。</p>
      ) : (
        <Table>
          <thead>
            <tr>
              <th scope="col">状態</th>
              <th scope="col">招待した人</th>
              <th scope="col">参加したユーザー</th>
              <th scope="col">作成日時</th>
              <th scope="col">期限</th>
            </tr>
          </thead>
          <tbody>
            {invitations.map((invitation) => (
              <tr key={invitation.id}>
                <th scope="row" className={common.nowrap}>
                  {invitationStatusLabel(invitation.status)}
                </th>
                <td>
                  <UserLink
                    id={invitation.createdByUserId}
                    name={invitation.createdByUserName}
                  />
                </td>
                <td>
                  {invitation.acceptedByUserId ? (
                    <>
                      <UserLink
                        id={invitation.acceptedByUserId}
                        name={invitation.acceptedByUserName ?? ""}
                      />
                      {invitation.acceptedAt ? (
                        <span className={common.sub}>
                          {formatDateTime(invitation.acceptedAt)}
                        </span>
                      ) : null}
                    </>
                  ) : (
                    <span className={common.empty}>-</span>
                  )}
                </td>
                <td className={common.nowrap}>
                  {formatDateTime(invitation.createdAt)}
                </td>
                <td className={common.nowrap}>
                  {formatDateTime(invitation.expiresAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </DetailSection>
  );
}

/** 家の詳細。メンバーの追加・削除の操作は一覧と同じ */
export function HouseholdDetailPage() {
  const householdId = useParams().householdId ?? "";
  const navigate = useNavigate();
  const { state, reload } = useApi<HouseholdDetailResponse>(
    householdPath(householdId),
  );
  const [removal, setRemoval] = useState<MemberRemoval | null>(null);

  if (
    state.status === "error" &&
    state.error instanceof ApiError &&
    state.error.status === 404
  ) {
    return (
      <NotFoundPage message="家が見つかりませんでした。ID が正しいか確かめてください。" />
    );
  }

  const showResult = (memberChange: string, userId: string) => {
    const params = new URLSearchParams({
      memberChange,
      household: householdId,
      user: userId,
    });
    navigate(`${householdPath(householdId)}?${params}`);
    reload();
  };
  const name = state.status === "success" ? state.data.household.name : null;

  return (
    <Page
      title={name ?? "家の詳細"}
      breadcrumb={[HOUSEHOLDS_BREADCRUMB_ROOT, { label: name ?? "詳細" }]}
    >
      <Loadable state={state} reload={reload}>
        {({ household, users }) => (
          <>
            <MemberChangeNotice households={[household]} users={users} />
            <DetailSection title="基本情報">
              <DetailFacts>
                <dt>ID</dt>
                <dd>
                  <code>{household.id}</code>
                </dd>
                <dt>作成日時</dt>
                <dd>{formatDateTime(household.createdAt)}</dd>
                <dt>更新日時</dt>
                <dd>{formatDateTime(household.updatedAt)}</dd>
              </DetailFacts>
            </DetailSection>
            <MembersSection
              household={household}
              users={users}
              onAdded={(userId, ok) =>
                showResult(ok ? "added" : "add-failed", userId)
              }
              onRemove={setRemoval}
            />
            <CatsSection household={household} />
            <InvitationsSection household={household} />
          </>
        )}
      </Loadable>
      <RemoveMemberDialog
        removal={removal}
        onClose={() => setRemoval(null)}
        onRemoved={(removed, ok) => {
          setRemoval(null);
          showResult(ok ? "removed" : "remove-failed", removed.userId);
        }}
      />
    </Page>
  );
}
