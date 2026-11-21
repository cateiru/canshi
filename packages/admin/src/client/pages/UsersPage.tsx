import {
  Button,
  Table,
  TableActionCell,
  TableActionHeader,
} from "@canshi/shared/ui";
import { useState } from "react";
import { useNavigate } from "react-router";
import type { UserJson, UsersResponse } from "../../api/types";
import common from "../common.module.css";
import { Loadable } from "../components/Loadable";
import { Page } from "../components/Page";
import { formatDateTime, householdRoleLabel } from "../format";
import { householdPath, userPath } from "../paths";
import { RouterLink } from "../RouterLink";
import { useApi } from "../useApi";
import table from "./table.module.css";
import {
  LogoutDialog,
  UserChangeNotice,
  UserRoleForm,
  UserRoleLead,
} from "./userActions";

function UsersTable(props: {
  users: UserJson[];
  onRoleChanged: (user: UserJson, ok: boolean) => void;
  onLogout: (user: UserJson) => void;
}) {
  return (
    <Table>
      <thead>
        <tr>
          <th scope="col">名前</th>
          <th scope="col">権限</th>
          <th scope="col">所属する家</th>
          <th scope="col">有効なセッション</th>
          <th scope="col">セッションの期限</th>
          <th scope="col">登録日時</th>
          <TableActionHeader />
        </tr>
      </thead>
      <tbody>
        {props.users.map((user) => (
          <tr key={user.id}>
            <th scope="row">
              <RouterLink
                href={userPath(user.id)}
                className={`${table.name} ${common.link}`}
              >
                {user.name}
              </RouterLink>
              <code className={common.code}>{user.id}</code>
            </th>
            <td>
              {/* 権限を変えたあとに選び直した値を捨てるよう、今の権限ごとに作り直す */}
              <UserRoleForm
                key={user.role}
                user={user}
                onChanged={(ok) => props.onRoleChanged(user, ok)}
              />
            </td>
            <td>
              {user.households.length === 0 ? (
                <span className={common.empty}>なし</span>
              ) : (
                <ul>
                  {user.households.map((household) => (
                    <li key={household.householdId}>
                      <RouterLink
                        href={householdPath(household.householdId)}
                        className={common.link}
                      >
                        {household.householdName}
                      </RouterLink>
                      （{householdRoleLabel(household.role)}）
                    </li>
                  ))}
                </ul>
              )}
            </td>
            <td className={common.num}>{user.activeSessionCount}</td>
            <td className={common.nowrap}>
              {user.latestSessionExpiresAt ? (
                formatDateTime(user.latestSessionExpiresAt)
              ) : (
                <span className={common.empty}>-</span>
              )}
            </td>
            <td className={common.nowrap}>{formatDateTime(user.createdAt)}</td>
            <TableActionCell>
              {user.activeSessionCount > 0 ? (
                <Button variant="danger" onPress={() => props.onLogout(user)}>
                  すべての端末からログアウト
                </Button>
              ) : null}
            </TableActionCell>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

export function UsersPage() {
  const { state, reload } = useApi<UsersResponse>("/users");
  const navigate = useNavigate();
  const [logoutUser, setLogoutUser] = useState<UserJson | null>(null);

  const showResult = (params: Record<string, string>) => {
    navigate(`/users?${new URLSearchParams(params)}`);
    reload();
  };

  return (
    <Page title="ユーザー">
      <Loadable state={state} reload={reload}>
        {({ users }) =>
          users.length === 0 ? (
            <p className={common.empty}>ユーザーはまだいません。</p>
          ) : (
            <>
              <UserChangeNotice users={users} />
              <UserRoleLead />
              <UsersTable
                users={users}
                onRoleChanged={(user, ok) =>
                  showResult({
                    roleChange: ok ? "updated" : "update-failed",
                    user: user.id,
                  })
                }
                onLogout={setLogoutUser}
              />
            </>
          )
        }
      </Loadable>
      <LogoutDialog
        user={logoutUser}
        onClose={() => setLogoutUser(null)}
        onLoggedOut={(userId) => {
          setLogoutUser(null);
          showResult({ loggedOut: userId });
        }}
      />
    </Page>
  );
}
