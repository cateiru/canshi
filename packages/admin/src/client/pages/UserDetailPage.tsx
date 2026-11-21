import { Button, Table } from "@canshi/shared/ui";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import type { UserDetailJson, UserDetailResponse } from "../../api/types";
import { ApiError } from "../api";
import common from "../common.module.css";
import { DetailFacts, DetailSection } from "../components/DetailSection";
import { Loadable } from "../components/Loadable";
import { Page } from "../components/Page";
import { formatDateTime, householdRoleLabel } from "../format";
import { householdPath, userPath } from "../paths";
import { RouterLink } from "../RouterLink";
import { useApi } from "../useApi";
import { NotFoundPage } from "./NotFoundPage";
import {
  LogoutDialog,
  UserChangeNotice,
  type UserChangeResult,
  UserRoleForm,
  UserRoleLead,
} from "./userActions";

const USERS_BREADCRUMB_ROOT = { label: "ユーザー", href: "/users" };

function HouseholdsSection(props: { user: UserDetailJson }) {
  const { households } = props.user;
  return (
    <DetailSection title="所属する家">
      {households.length === 0 ? (
        <p className={common.empty}>どの家にも所属していません。</p>
      ) : (
        <Table>
          <thead>
            <tr>
              <th scope="col">家</th>
              <th scope="col">家での権限</th>
              <th scope="col">参加日時</th>
            </tr>
          </thead>
          <tbody>
            {households.map((household) => (
              <tr key={household.householdId}>
                <th scope="row">
                  <RouterLink
                    href={householdPath(household.householdId)}
                    className={common.link}
                  >
                    {household.householdName}
                  </RouterLink>
                  <code className={common.code}>{household.householdId}</code>
                </th>
                <td className={common.nowrap}>
                  {householdRoleLabel(household.role)}
                </td>
                <td className={common.nowrap}>
                  {formatDateTime(household.joinedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </DetailSection>
  );
}

function SessionsSection(props: {
  user: UserDetailJson;
  onLogout: () => void;
}) {
  const { sessions } = props.user;
  return (
    <DetailSection title="ログイン中の端末">
      {sessions.length === 0 ? (
        <p className={common.empty}>ログイン中の端末はありません。</p>
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <th scope="col">端末</th>
                <th scope="col">ログインした日時</th>
                <th scope="col">期限</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => (
                <tr key={session.id}>
                  <th scope="row">{session.deviceName}</th>
                  <td className={common.nowrap}>
                    {formatDateTime(session.createdAt)}
                  </td>
                  <td className={common.nowrap}>
                    {formatDateTime(session.expiresAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
          <div>
            <Button variant="danger" onPress={props.onLogout}>
              すべての端末からログアウト
            </Button>
          </div>
        </>
      )}
    </DetailSection>
  );
}

function PushSubscriptionsSection(props: { user: UserDetailJson }) {
  const { pushSubscriptions } = props.user;
  return (
    <DetailSection title="通知を受け取る端末">
      {pushSubscriptions.length === 0 ? (
        <p className={common.empty}>通知を受け取る端末はありません。</p>
      ) : (
        <Table>
          <thead>
            <tr>
              <th scope="col">端末</th>
              <th scope="col">登録日時</th>
              <th scope="col">最後に送れた日時</th>
              <th scope="col">続けて送れなかった回数</th>
            </tr>
          </thead>
          <tbody>
            {pushSubscriptions.map((subscription) => (
              <tr key={subscription.id}>
                <th scope="row">{subscription.deviceName}</th>
                <td className={common.nowrap}>
                  {formatDateTime(subscription.createdAt)}
                </td>
                <td className={common.nowrap}>
                  {subscription.lastUsedAt ? (
                    formatDateTime(subscription.lastUsedAt)
                  ) : (
                    <span className={common.empty}>-</span>
                  )}
                </td>
                <td className={common.num}>{subscription.failureCount}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </DetailSection>
  );
}

/** ユーザーの詳細。権限の変更とすべての端末からログアウトさせる操作は、詳細でだけ行う */
export function UserDetailPage() {
  const userId = useParams().userId ?? "";
  const navigate = useNavigate();
  const { state, reload } = useApi<UserDetailResponse>(userPath(userId));
  const [isLogoutOpen, setIsLogoutOpen] = useState(false);

  if (
    state.status === "error" &&
    state.error instanceof ApiError &&
    state.error.status === 404
  ) {
    return (
      <NotFoundPage message="ユーザーが見つかりませんでした。ID が正しいか確かめてください。" />
    );
  }

  const showResult = (result: UserChangeResult) => {
    navigate(`${userPath(userId)}?${new URLSearchParams(result)}`);
    reload();
  };
  const name = state.status === "success" ? state.data.user.name : null;

  return (
    <Page
      title={name ?? "ユーザーの詳細"}
      breadcrumb={[USERS_BREADCRUMB_ROOT, { label: name ?? "詳細" }]}
    >
      <Loadable state={state} reload={reload}>
        {({ user }) => (
          <>
            <UserChangeNotice user={user} />
            <DetailSection title="基本情報">
              <DetailFacts>
                <dt>ID</dt>
                <dd>
                  <code>{user.id}</code>
                </dd>
                <dt>権限</dt>
                <dd>
                  {/* 権限を変えたあとに選び直した値を捨てるよう、今の権限ごとに作り直す */}
                  <UserRoleForm
                    key={user.role}
                    user={user}
                    onChanged={(ok) =>
                      showResult({
                        roleChange: ok ? "updated" : "update-failed",
                      })
                    }
                  />
                </dd>
                <dt>登録日時</dt>
                <dd>{formatDateTime(user.createdAt)}</dd>
                <dt>更新日時</dt>
                <dd>{formatDateTime(user.updatedAt)}</dd>
              </DetailFacts>
              <UserRoleLead />
            </DetailSection>
            <HouseholdsSection user={user} />
            <SessionsSection
              user={user}
              onLogout={() => setIsLogoutOpen(true)}
            />
            <PushSubscriptionsSection user={user} />
            <LogoutDialog
              user={user}
              open={isLogoutOpen}
              onClose={() => setIsLogoutOpen(false)}
              onLoggedOut={() => {
                setIsLogoutOpen(false);
                showResult({ loggedOut: "1" });
              }}
            />
          </>
        )}
      </Loadable>
    </Page>
  );
}
