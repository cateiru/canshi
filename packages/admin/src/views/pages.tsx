import type { AdminHousehold, AdminUser, Overview } from "../db/queries";
import { formatDateTime, householdRoleLabel, userRoleLabel } from "./format";

export function OverviewPage(props: { overview: Overview }) {
  const { overview } = props;
  return (
    <>
      <dl class="stats">
        <div class="stat">
          <dt>ユーザー</dt>
          <dd>{overview.userCount}</dd>
        </div>
        <div class="stat">
          <dt>家</dt>
          <dd>{overview.householdCount}</dd>
        </div>
        <div class="stat">
          <dt>猫</dt>
          <dd>{overview.catCount}</dd>
        </div>
        <div class="stat">
          <dt>家に未所属の猫</dt>
          <dd>{overview.unassignedCatCount}</dd>
        </div>
      </dl>
      {overview.unassignedCatCount > 0 && (
        <p class="warning" role="status">
          家に所属していない猫が {overview.unassignedCatCount}{" "}
          匹います。どのユーザーからも表示されないため、
          <code>pnpm household:link --remote</code>
          （ローカルの D1 では <code>--local</code>）で家に紐付けてください。
        </p>
      )}
    </>
  );
}

export function UsersPage(props: { users: AdminUser[] }) {
  if (props.users.length === 0) {
    return <p class="empty">ユーザーはまだいません。</p>;
  }
  return (
    <div class="table-wrap">
      <table>
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
            <tr>
              <td>
                {user.name}
                <br />
                <code>{user.id}</code>
              </td>
              <td>{userRoleLabel(user.role)}</td>
              <td>
                {user.households.length === 0 ? (
                  <span class="empty">なし</span>
                ) : (
                  <ul class="plain">
                    {user.households.map((household) => (
                      <li>
                        {household.householdName}（
                        {householdRoleLabel(household.role)}）
                      </li>
                    ))}
                  </ul>
                )}
              </td>
              <td class="num">{user.activeSessionCount}</td>
              <td>
                {user.latestSessionExpiresAt ? (
                  formatDateTime(user.latestSessionExpiresAt)
                ) : (
                  <span class="empty">-</span>
                )}
              </td>
              <td>{formatDateTime(user.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function HouseholdsPage(props: { households: AdminHousehold[] }) {
  if (props.households.length === 0) {
    return <p class="empty">家はまだありません。</p>;
  }
  return (
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th scope="col">名前</th>
            <th scope="col">メンバー</th>
            <th scope="col">猫</th>
            <th scope="col">作成日時</th>
          </tr>
        </thead>
        <tbody>
          {props.households.map((household) => (
            <tr>
              <td>
                {household.name}
                <br />
                <code>{household.id}</code>
              </td>
              <td>
                {household.members.length === 0 ? (
                  <span class="empty">なし</span>
                ) : (
                  <ul class="plain">
                    {household.members.map((member) => (
                      <li>
                        {member.userName}（{householdRoleLabel(member.role)}）
                      </li>
                    ))}
                  </ul>
                )}
              </td>
              <td class="num">{household.catCount}</td>
              <td>{formatDateTime(household.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
