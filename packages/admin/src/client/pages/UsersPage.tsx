import { Table } from "@canshi/shared/ui";
import type { UserJson, UsersResponse } from "../../api/types";
import common from "../common.module.css";
import { Loadable } from "../components/Loadable";
import { Page } from "../components/Page";
import { formatDateTime, householdRoleLabel, userRoleLabel } from "../format";
import { householdPath, userPath } from "../paths";
import { RouterLink } from "../RouterLink";
import { useApi } from "../useApi";
import table from "./table.module.css";

function UsersTable(props: { users: UserJson[] }) {
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
        </tr>
      </thead>
      <tbody>
        {props.users.map((user) => (
          <tr key={user.id}>
            <th scope="row" className={table.textColumn}>
              <RouterLink
                href={userPath(user.id)}
                className={`${table.name} ${common.link}`}
              >
                {user.name}
              </RouterLink>
              <code className={common.code}>{user.id}</code>
            </th>
            <td className={common.nowrap}>{userRoleLabel(user.role)}</td>
            <td className={table.textColumn}>
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
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

/**
 * ユーザーの一覧。表示だけで、権限の変更・すべての端末からログアウトさせる操作は
 * ユーザーの詳細（`/users/:userId`）で行う
 */
export function UsersPage() {
  const { state, reload } = useApi<UsersResponse>("/users");
  return (
    <Page title="ユーザー">
      <Loadable state={state} reload={reload}>
        {({ users }) =>
          users.length === 0 ? (
            <p className={common.empty}>ユーザーはまだいません。</p>
          ) : (
            <UsersTable users={users} />
          )
        }
      </Loadable>
    </Page>
  );
}
