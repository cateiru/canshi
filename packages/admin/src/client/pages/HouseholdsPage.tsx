import { Table } from "@canshi/shared/ui";
import type { HouseholdsResponse } from "../../api/types";
import common from "../common.module.css";
import { Loadable } from "../components/Loadable";
import { Page } from "../components/Page";
import { formatDateTime, householdRoleLabel } from "../format";
import { householdPath, userPath } from "../paths";
import { RouterLink } from "../RouterLink";
import { useApi } from "../useApi";
import table from "./table.module.css";

/**
 * 家の一覧。表示だけで、メンバーの追加・削除は家の詳細（`/households/:householdId`）で行う
 */
export function HouseholdsPage() {
  const { state, reload } = useApi<HouseholdsResponse>("/households");
  return (
    <Page title="家">
      <Loadable state={state} reload={reload}>
        {({ households }) =>
          households.length === 0 ? (
            <p className={common.empty}>家はまだありません。</p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th scope="col">名前</th>
                  <th scope="col">メンバー</th>
                  <th scope="col">猫</th>
                  <th scope="col">作成日時</th>
                </tr>
              </thead>
              <tbody>
                {households.map((household) => (
                  <tr key={household.id}>
                    <th scope="row" className={table.textColumn}>
                      <RouterLink
                        href={householdPath(household.id)}
                        className={`${table.name} ${common.link}`}
                      >
                        {household.name}
                      </RouterLink>
                      <code className={common.code}>{household.id}</code>
                    </th>
                    <td className={table.textColumn}>
                      {household.members.length === 0 ? (
                        <span className={common.empty}>なし</span>
                      ) : (
                        <ul>
                          {household.members.map((member) => (
                            <li key={member.userId}>
                              <RouterLink
                                href={userPath(member.userId)}
                                className={common.link}
                              >
                                {member.userName}
                              </RouterLink>
                              （{householdRoleLabel(member.role)}）
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className={common.num}>{household.catCount}</td>
                    <td className={common.nowrap}>
                      {formatDateTime(household.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )
        }
      </Loadable>
    </Page>
  );
}
