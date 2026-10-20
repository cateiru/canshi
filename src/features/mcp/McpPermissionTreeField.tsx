"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui";
import { HouseholdIcon } from "@/components/ui/RecordIcons/RecordIcons";
import { CatIcon } from "@/features/cats/CatIcon";
import {
  TIMELINE_TYPE_ICON,
  TIMELINE_TYPE_LABEL,
} from "@/features/timeline/labels";
import styles from "./McpPermissionTreeField.module.css";
import {
  MCP_HOUSEHOLD_OPERATION_GROUPS,
  MCP_HOUSEHOLD_OPERATIONS,
  MCP_PERMISSION_RECORD_TYPES,
  MCP_PERMISSIONS_FIELD_NAME,
  type McpHouseholdOperation,
  type McpPermissionRecordType,
  type McpPermissions,
  type McpPermissionTreeHousehold,
} from "./permissionRules";

type McpPermissionTreeFieldProps = {
  /** 表示する家・猫と、最初のチェックの状態 */
  tree: McpPermissionTreeHousehold[];
};

/**
 * チェックの状態。家・猫・（猫ごとの）記録の種類の読み取り・書き込みと、（家ごとの）ごはん商品・
 * プリセットの操作のうち、チェックが付いているもの
 */
type CheckedState = {
  households: Set<string>;
  cats: Set<string>;
  records: Map<string, Set<McpPermissionRecordType>>;
  writes: Map<string, Set<McpPermissionRecordType>>;
  operations: Map<string, Set<McpHouseholdOperation>>;
};

/**
 * AI との接続から読み取れる範囲と書き込める範囲を、家 → 猫 → 記録の種類の階層の
 * チェックボックスで選ぶフォームの項目。記録の種類ごとに「読む」「書く」（追加・編集）を、
 * 家ごとにごはん商品・プリセットの操作を選ぶ。送信ボタンは持たず、選んだ範囲を hidden の
 * input（`mcpPermissions`）に JSON で入れる。設定画面（Server Action）と同意画面
 * （Worker への POST）で共通に使う。
 *
 * - 親のチェックを外すと、子のチェック（書き込み・操作を含む）もすべて外れる
 * - 親にチェックを付けると、子の読み取りにすべてチェックが付く（書き込みには付けない）
 * - 子にチェックを付けると、親にもチェックが付く
 * - 書き込みは読み取りを含むため、「書く」を付けると「読む」にも付き、「読む」を外すと
 *   「書く」も外れる
 * - 親にチェックが付いていて、子の読み取りの一部だけにチェックが付いているときは「一部」の表示にする
 *
 * 読み取りは外したもの（表示した家・猫だけ）を、書き込み・操作は許可したものを送る。
 * 表示した後に登録された猫などは、読み取れるが書き込めない（`toPermissions` 参照）
 */
export function McpPermissionTreeField({ tree }: McpPermissionTreeFieldProps) {
  const [checked, setChecked] = useState(() => initialState(tree));

  const update = (change: (draft: CheckedState) => void) => {
    setChecked((current) => {
      const draft: CheckedState = {
        households: new Set(current.households),
        cats: new Set(current.cats),
        records: copySets(current.records),
        writes: copySets(current.writes),
        operations: copySets(current.operations),
      };
      change(draft);
      return draft;
    });
  };

  const setCat = (draft: CheckedState, catId: string, value: boolean) => {
    toggle(draft.cats, catId, value);
    draft.records.set(catId, new Set(value ? MCP_PERMISSION_RECORD_TYPES : []));
    if (!value) {
      draft.writes.set(catId, new Set());
    }
  };

  if (tree.length === 0) {
    return (
      <p className={styles.empty}>
        所属している家がありません。家を作成するか、家に参加すると選べるようになります。
      </p>
    );
  }

  return (
    <div className={styles.field}>
      <input
        type="hidden"
        name={MCP_PERMISSIONS_FIELD_NAME}
        value={JSON.stringify(toPermissions(tree, checked))}
      />
      <ul className={styles.households}>
        {tree.map((household) => {
          const householdChecked = checked.households.has(household.id);
          const allCatsFull = household.cats.every(
            (cat) =>
              checked.cats.has(cat.id) && isAllRecordsChecked(checked, cat.id),
          );
          const operations = checked.operations.get(household.id);
          return (
            <li key={household.id} className={styles.household}>
              <Checkbox
                className={styles.householdCheckbox}
                isSelected={householdChecked && allCatsFull}
                isIndeterminate={householdChecked && !allCatsFull}
                onChange={(value) =>
                  update((draft) => {
                    toggle(draft.households, household.id, value);
                    for (const cat of household.cats) {
                      setCat(draft, cat.id, value);
                    }
                    if (!value) {
                      draft.operations.set(household.id, new Set());
                    }
                  })
                }
              >
                <HouseholdIcon
                  className={styles.icon}
                  size={20}
                  aria-hidden="true"
                />
                <span className={styles.name}>{household.name}</span>
              </Checkbox>
              <div className={styles.operations}>
                {MCP_HOUSEHOLD_OPERATION_GROUPS.map((group) => (
                  <fieldset
                    key={group.label}
                    aria-label={`${household.name}の${group.label}`}
                    className={styles.operationGroup}
                  >
                    <span className={styles.operationLabel}>{group.label}</span>
                    <span className={styles.operationChoices}>
                      {group.operations.map(({ operation, label }) => (
                        <Checkbox
                          key={operation}
                          aria-label={`${group.label}を${label}`}
                          isSelected={operations?.has(operation) ?? false}
                          onChange={(value) =>
                            update((draft) => {
                              const set =
                                draft.operations.get(household.id) ?? new Set();
                              toggle(set, operation, value);
                              draft.operations.set(household.id, set);
                              if (value) {
                                draft.households.add(household.id);
                              }
                            })
                          }
                        >
                          {label}
                        </Checkbox>
                      ))}
                    </span>
                  </fieldset>
                ))}
              </div>
              {household.cats.length === 0 ? (
                <p className={styles.noCats}>この家には猫がいません。</p>
              ) : (
                <ul className={styles.cats}>
                  {household.cats.map((cat) => {
                    const catChecked = checked.cats.has(cat.id);
                    const allRecords = isAllRecordsChecked(checked, cat.id);
                    const recordTypes = checked.records.get(cat.id);
                    const writeTypes = checked.writes.get(cat.id);
                    return (
                      <li key={cat.id} className={styles.cat}>
                        <Checkbox
                          className={styles.catCheckbox}
                          isSelected={catChecked && allRecords}
                          isIndeterminate={catChecked && !allRecords}
                          onChange={(value) =>
                            update((draft) => {
                              setCat(draft, cat.id, value);
                              if (value) {
                                draft.households.add(household.id);
                              }
                            })
                          }
                        >
                          <CatIcon
                            className={styles.icon}
                            size={20}
                            aria-hidden="true"
                          />
                          <span className={styles.name}>{cat.name}</span>
                        </Checkbox>
                        <fieldset
                          aria-label={`${cat.name}の記録`}
                          className={styles.records}
                        >
                          {MCP_PERMISSION_RECORD_TYPES.map((type) => {
                            const Icon = TIMELINE_TYPE_ICON[type];
                            const label = TIMELINE_TYPE_LABEL[type];
                            return (
                              <fieldset
                                key={type}
                                className={styles.record}
                                aria-label={`${cat.name}の${label}`}
                              >
                                <span className={styles.recordLabel}>
                                  <Icon
                                    className={styles.icon}
                                    size={18}
                                    aria-hidden="true"
                                  />
                                  {label}
                                </span>
                                <span className={styles.choices}>
                                  <Checkbox
                                    aria-label={`${label}を読む`}
                                    isSelected={recordTypes?.has(type) ?? false}
                                    onChange={(value) =>
                                      update((draft) => {
                                        setRead(draft, cat.id, type, value);
                                        if (value) {
                                          draft.cats.add(cat.id);
                                          draft.households.add(household.id);
                                        }
                                      })
                                    }
                                  >
                                    読む
                                  </Checkbox>
                                  <Checkbox
                                    aria-label={`${label}を書く`}
                                    isSelected={writeTypes?.has(type) ?? false}
                                    onChange={(value) =>
                                      update((draft) => {
                                        const writes =
                                          draft.writes.get(cat.id) ?? new Set();
                                        toggle(writes, type, value);
                                        draft.writes.set(cat.id, writes);
                                        // 書き込みは読み取りを含む
                                        if (value) {
                                          setRead(draft, cat.id, type, true);
                                          draft.cats.add(cat.id);
                                          draft.households.add(household.id);
                                        }
                                      })
                                    }
                                  >
                                    書く
                                  </Checkbox>
                                </span>
                              </fieldset>
                            );
                          })}
                        </fieldset>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** 記録の種類の読み取りのチェックを変える。読み取りを外すと、書き込みも外す */
function setRead(
  draft: CheckedState,
  catId: string,
  type: McpPermissionRecordType,
  value: boolean,
) {
  const types = draft.records.get(catId) ?? new Set();
  toggle(types, type, value);
  draft.records.set(catId, types);
  if (!value) {
    draft.writes.get(catId)?.delete(type);
  }
}

function copySets<T>(map: Map<string, Set<T>>) {
  return new Map([...map].map(([key, values]) => [key, new Set(values)]));
}

function initialState(tree: McpPermissionTreeHousehold[]): CheckedState {
  const state: CheckedState = {
    households: new Set(),
    cats: new Set(),
    records: new Map(),
    writes: new Map(),
    operations: new Map(),
  };
  for (const household of tree) {
    if (household.checked) {
      state.households.add(household.id);
    }
    state.operations.set(household.id, new Set(household.operations));
    for (const cat of household.cats) {
      if (cat.checked) {
        state.cats.add(cat.id);
      }
      state.records.set(cat.id, new Set(cat.checkedRecordTypes));
      state.writes.set(cat.id, new Set(cat.writableRecordTypes));
    }
  }
  return state;
}

function isAllRecordsChecked(state: CheckedState, catId: string) {
  return (
    (state.records.get(catId)?.size ?? 0) === MCP_PERMISSION_RECORD_TYPES.length
  );
}

function toggle<T>(set: Set<T>, value: T, on: boolean) {
  if (on) {
    set.add(value);
  } else {
    set.delete(value);
  }
}

/**
 * チェックの状態から、送る値を作る。読み取りは外したものを送る。家を外したときは、その家の
 * 猫も外したものとして送る。猫が外した家から別の家へ引っ越しても、画面で見えていたとおり
 * 読み取れないままにするため。外した猫の記録の種類は、猫を外せば読み取れないため送らない。
 * 書き込み・操作は、読み取りにもチェックが付いているものだけを、許可したものとして送る
 */
export function toPermissions(
  tree: McpPermissionTreeHousehold[],
  state: CheckedState,
): McpPermissions {
  const permissions: McpPermissions = {
    excludedHouseholdIds: [],
    excludedCatIds: [],
    excludedRecordTypes: {},
    writableRecordTypes: {},
    householdOperations: {},
  };
  for (const household of tree) {
    if (!state.households.has(household.id)) {
      permissions.excludedHouseholdIds.push(household.id);
      permissions.excludedCatIds.push(...household.cats.map((cat) => cat.id));
      continue;
    }
    const operations = state.operations.get(household.id);
    if (operations && operations.size > 0) {
      permissions.householdOperations[household.id] =
        MCP_HOUSEHOLD_OPERATIONS.filter((operation) =>
          operations.has(operation),
        );
    }
    for (const cat of household.cats) {
      if (!state.cats.has(cat.id)) {
        permissions.excludedCatIds.push(cat.id);
        continue;
      }
      const types = state.records.get(cat.id);
      const excluded = MCP_PERMISSION_RECORD_TYPES.filter(
        (type) => !types?.has(type),
      );
      if (excluded.length > 0) {
        permissions.excludedRecordTypes[cat.id] = excluded;
      }
      const writes = state.writes.get(cat.id);
      const writable = MCP_PERMISSION_RECORD_TYPES.filter(
        (type) => types?.has(type) && writes?.has(type),
      );
      if (writable.length > 0) {
        permissions.writableRecordTypes[cat.id] = writable;
      }
    }
  }
  return permissions;
}
