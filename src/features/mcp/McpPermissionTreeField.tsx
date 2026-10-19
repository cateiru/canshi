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
  MCP_PERMISSION_RECORD_TYPES,
  MCP_PERMISSIONS_FIELD_NAME,
  type McpPermissionRecordType,
  type McpPermissionTreeHousehold,
  type McpReadScope,
} from "./permissionRules";

type McpPermissionTreeFieldProps = {
  /** 表示する家・猫と、最初のチェックの状態 */
  tree: McpPermissionTreeHousehold[];
};

/** チェックの状態。家・猫・（猫ごとの）記録の種類のうち、チェックが付いているもの */
type CheckedState = {
  households: Set<string>;
  cats: Set<string>;
  records: Map<string, Set<McpPermissionRecordType>>;
};

/**
 * AI との接続から読み取れる範囲を、家 → 猫 → 記録の種類の階層のチェックボックスで選ぶ
 * フォームの項目。送信ボタンは持たず、選んだ範囲を hidden の input（`mcpPermissions`）に
 * JSON で入れる。設定画面（Server Action）と同意画面（Worker への POST）で共通に使う。
 *
 * - 親のチェックを外すと、子のチェックもすべて外れる
 * - 親にチェックを付けると、子にもすべてチェックが付く
 * - 子にチェックを付けると、親にもチェックが付く
 * - 親にチェックが付いていて、子の一部だけにチェックが付いているときは「一部」の表示にする
 *
 * 送るのはチェックを外したもの（表示した家・猫だけ）で、表示した後に登録された猫などは
 * 読み取れるままにする（`toPermissions` 参照）
 */
export function McpPermissionTreeField({ tree }: McpPermissionTreeFieldProps) {
  const [checked, setChecked] = useState(() => initialState(tree));

  const update = (change: (draft: CheckedState) => void) => {
    setChecked((current) => {
      const draft: CheckedState = {
        households: new Set(current.households),
        cats: new Set(current.cats),
        records: new Map(
          [...current.records].map(([catId, types]) => [catId, new Set(types)]),
        ),
      };
      change(draft);
      return draft;
    });
  };

  const setCat = (draft: CheckedState, catId: string, value: boolean) => {
    toggle(draft.cats, catId, value);
    draft.records.set(catId, new Set(value ? MCP_PERMISSION_RECORD_TYPES : []));
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
                  })
                }
              >
                <HouseholdIcon
                  className={styles.icon}
                  size={20}
                  aria-hidden="true"
                />
                {household.name}
              </Checkbox>
              {household.cats.length === 0 ? (
                <p className={styles.noCats}>この家には猫がいません。</p>
              ) : (
                <ul className={styles.cats}>
                  {household.cats.map((cat) => {
                    const catChecked = checked.cats.has(cat.id);
                    const allRecords = isAllRecordsChecked(checked, cat.id);
                    const recordTypes = checked.records.get(cat.id);
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
                          {cat.name}
                        </Checkbox>
                        {/* biome-ignore lint/a11y/useSemanticElements: fieldset は既定のスタイルの打ち消しが多くなるため使わない */}
                        <div
                          role="group"
                          aria-label={`${cat.name}の記録`}
                          className={styles.records}
                        >
                          {MCP_PERMISSION_RECORD_TYPES.map((type) => {
                            const Icon = TIMELINE_TYPE_ICON[type];
                            return (
                              <Checkbox
                                key={type}
                                isSelected={recordTypes?.has(type) ?? false}
                                onChange={(value) =>
                                  update((draft) => {
                                    const types =
                                      draft.records.get(cat.id) ?? new Set();
                                    toggle(types, type, value);
                                    draft.records.set(cat.id, types);
                                    if (value) {
                                      draft.cats.add(cat.id);
                                      draft.households.add(household.id);
                                    }
                                  })
                                }
                              >
                                <Icon
                                  className={styles.icon}
                                  size={18}
                                  aria-hidden="true"
                                />
                                {TIMELINE_TYPE_LABEL[type]}
                              </Checkbox>
                            );
                          })}
                        </div>
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

function initialState(tree: McpPermissionTreeHousehold[]): CheckedState {
  const state: CheckedState = {
    households: new Set(),
    cats: new Set(),
    records: new Map(),
  };
  for (const household of tree) {
    if (household.checked) {
      state.households.add(household.id);
    }
    for (const cat of household.cats) {
      if (cat.checked) {
        state.cats.add(cat.id);
      }
      state.records.set(cat.id, new Set(cat.checkedRecordTypes));
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
 * チェックの状態から、送る値（外したもの）を作る。家を外したときは、その家の猫も外したものとして
 * 送る。猫が外した家から別の家へ引っ越しても、画面で見えていたとおり読み取れないままにするため。
 * 外した猫の記録の種類は、猫を外せば読み取れないため送らない
 */
export function toPermissions(
  tree: McpPermissionTreeHousehold[],
  state: CheckedState,
): McpReadScope {
  const permissions: McpReadScope = {
    excludedHouseholdIds: [],
    excludedCatIds: [],
    excludedRecordTypes: {},
  };
  for (const household of tree) {
    if (!state.households.has(household.id)) {
      permissions.excludedHouseholdIds.push(household.id);
      permissions.excludedCatIds.push(...household.cats.map((cat) => cat.id));
      continue;
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
    }
  }
  return permissions;
}
