import { Button, Table } from "@canshi/shared/ui";
import { useState } from "react";
import { useNavigate } from "react-router";
import type { HouseholdsResponse } from "../../api/types";
import common from "../common.module.css";
import { Loadable } from "../components/Loadable";
import { Page } from "../components/Page";
import { formatDateTime, householdRoleLabel } from "../format";
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
import table from "./table.module.css";

export function HouseholdsPage() {
  const { state, reload } = useApi<HouseholdsResponse>("/households");
  const navigate = useNavigate();
  const [removal, setRemoval] = useState<MemberRemoval | null>(null);

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
                    const candidates = memberCandidates(
                      users,
                      household.members.map((member) => member.userId),
                    );
                    return (
                      <tr key={household.id}>
                        <th scope="row">
                          <RouterLink
                            href={householdPath(household.id)}
                            className={`${table.name} ${common.link}`}
                          >
                            {household.name}
                          </RouterLink>
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
                                    <RouterLink
                                      href={userPath(member.userId)}
                                      className={common.link}
                                    >
                                      {member.userName}
                                    </RouterLink>
                                    （{householdRoleLabel(member.role)}）
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
      <RemoveMemberDialog
        removal={removal}
        onClose={() => setRemoval(null)}
        onRemoved={(removed, ok) => {
          setRemoval(null);
          showResult(
            ok ? "removed" : "remove-failed",
            removed.household.id,
            removed.userId,
          );
        }}
      />
    </Page>
  );
}
