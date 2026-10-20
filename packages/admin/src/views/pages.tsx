import {
  type AdminHousehold,
  type AdminUser,
  type Overview,
  USER_ROLES,
} from "../db/queries";
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

/** 直前に行ったユーザーの権限の変更とその結果 */
export interface UserRoleChange {
  result: "updated" | "update-failed";
  user: AdminUser;
}

function RoleChangeNotice(props: { change: UserRoleChange }) {
  const { result, user } = props.change;
  switch (result) {
    case "updated":
      return (
        <p class="notice" role="status">
          {user.name} の権限を{userRoleLabel(user.role)}にしました。
        </p>
      );
    case "update-failed":
      return (
        <p class="warning" role="alert">
          {user.name}{" "}
          の権限を変えられませんでした。選べる権限を選び直してください。
        </p>
      );
  }
}

export function UsersPage(props: {
  users: AdminUser[];
  /** 直前にすべての端末からログアウトさせたユーザー */
  loggedOutUser?: AdminUser;
  roleChange?: UserRoleChange;
}) {
  if (props.users.length === 0) {
    return <p class="empty">ユーザーはまだいません。</p>;
  }
  return (
    <>
      {props.loggedOutUser && (
        <p class="notice" role="status">
          {props.loggedOutUser.name} をすべての端末からログアウトさせました。
        </p>
      )}
      {props.roleChange && <RoleChangeNotice change={props.roleChange} />}
      <p class="lead">
        権限はアプリ全体の権限で、家の中での権限（オーナー・メンバー）とは別です。
        {userRoleLabel("admin")}
        にしても、この管理画面に入れるようにはなりません（管理画面に入れるユーザーは
        Cloudflare Access のポリシーで決まります）。
      </p>
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
              <th scope="col">操作</th>
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
                <td>
                  <form
                    method="post"
                    action={`/users/${encodeURIComponent(user.id)}/role`}
                    class="role-form"
                  >
                    <select
                      name="role"
                      required
                      aria-label={`${user.name} の権限`}
                    >
                      {USER_ROLES.map((role) => (
                        <option value={role} selected={role === user.role}>
                          {userRoleLabel(role)}
                        </option>
                      ))}
                    </select>
                    <button type="submit">変更</button>
                  </form>
                </td>
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
                <td>
                  {user.activeSessionCount > 0 ? (
                    // 確認文にはユーザー名などの入力値を含めない（属性値の中の JS として
                    // 実行されるため、エスケープしてもスクリプトを差し込まれうる）
                    <form
                      method="post"
                      action={`/users/${encodeURIComponent(user.id)}/sessions/delete`}
                      onsubmit="return confirm('このユーザーをすべての端末からログアウトさせますか？')"
                    >
                      <button type="submit" class="danger">
                        すべての端末からログアウト
                      </button>
                    </form>
                  ) : (
                    <span class="empty">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** 直前に行った家のメンバーの追加・削除とその結果 */
export interface HouseholdMemberChange {
  result: "added" | "removed" | "add-failed" | "remove-failed";
  household: AdminHousehold;
  user: AdminUser;
}

function MemberChangeNotice(props: { change: HouseholdMemberChange }) {
  const { result, household, user } = props.change;
  switch (result) {
    case "added":
      return (
        <p class="notice" role="status">
          {user.name} を {household.name} のメンバーに追加しました。
        </p>
      );
    case "removed":
      return (
        <p class="notice" role="status">
          {user.name} を {household.name} から外しました。
        </p>
      );
    case "add-failed":
      return (
        <p class="warning" role="alert">
          {user.name} を {household.name}{" "}
          のメンバーに追加できませんでした。すでにメンバーになっていないか確かめてください。
        </p>
      );
    case "remove-failed":
      return (
        <p class="warning" role="alert">
          {user.name} を {household.name}{" "}
          から外せませんでした。オーナーは外せないため、先にメインアプリでオーナーを移譲してください。
        </p>
      );
  }
}

export function HouseholdsPage(props: {
  households: AdminHousehold[];
  /** メンバーとして追加する候補（全ユーザー） */
  users: AdminUser[];
  memberChange?: HouseholdMemberChange;
}) {
  if (props.households.length === 0) {
    return <p class="empty">家はまだありません。</p>;
  }
  return (
    <>
      {props.memberChange && <MemberChangeNotice change={props.memberChange} />}
      <div class="table-wrap">
        <table>
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
            {props.households.map((household) => {
              const memberIds = new Set(
                household.members.map((member) => member.userId),
              );
              const candidates = props.users.filter(
                (user) => !memberIds.has(user.id),
              );
              const householdPath = `/households/${encodeURIComponent(household.id)}`;
              return (
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
                          <li class="member">
                            <span>
                              {member.userName}（
                              {householdRoleLabel(member.role)}）
                            </span>
                            {member.role === "member" && (
                              // 確認文にはユーザー名などの入力値を含めない（属性値の中の JS として
                              // 実行されるため、エスケープしてもスクリプトを差し込まれうる）
                              <form
                                method="post"
                                action={`${householdPath}/members/${encodeURIComponent(member.userId)}/delete`}
                                onsubmit="return confirm('このユーザーを家から外しますか？')"
                              >
                                <button type="submit" class="danger">
                                  家から外す
                                </button>
                              </form>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td class="num">{household.catCount}</td>
                  <td>{formatDateTime(household.createdAt)}</td>
                  <td>
                    {candidates.length === 0 ? (
                      <span class="empty">-</span>
                    ) : (
                      <form
                        method="post"
                        action={`${householdPath}/members`}
                        class="add-member"
                      >
                        <select
                          name="userId"
                          required
                          aria-label={`${household.name} に追加するユーザー`}
                        >
                          {candidates.map((user) => (
                            <option value={user.id}>
                              {user.name}（{user.id}）
                            </option>
                          ))}
                        </select>
                        <button type="submit">メンバーとして追加</button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
