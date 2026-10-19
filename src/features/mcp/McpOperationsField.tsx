"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui";
import styles from "./McpOperationsField.module.css";
import {
  MCP_OPERATION_GROUPS,
  MCP_OPERATIONS,
  MCP_OPERATIONS_FIELD_NAME,
  type McpOperation,
} from "./permissionRules";

type McpOperationsFieldProps = {
  /** 最初に許可している操作 */
  allowedOperations: McpOperation[];
};

/**
 * AI との接続に許可する操作（記録の追加・編集、ごはん商品・プリセットの操作）を
 * チェックボックスで選ぶフォームの項目。送信ボタンは持たず、チェックした操作を
 * hidden の input（`mcpOperations`）に JSON の配列で入れる。設定画面（Server Action）と
 * 同意画面（Worker への POST）で共通に使う
 */
export function McpOperationsField({
  allowedOperations,
}: McpOperationsFieldProps) {
  const [checked, setChecked] = useState(() => new Set(allowedOperations));

  const toggle = (operation: McpOperation, value: boolean) => {
    setChecked((current) => {
      const next = new Set(current);
      if (value) {
        next.add(operation);
      } else {
        next.delete(operation);
      }
      return next;
    });
  };

  return (
    <div className={styles.field}>
      <input
        type="hidden"
        name={MCP_OPERATIONS_FIELD_NAME}
        value={JSON.stringify(
          MCP_OPERATIONS.filter((operation) => checked.has(operation)),
        )}
      />
      <ul className={styles.groups}>
        {MCP_OPERATION_GROUPS.map((group) => (
          <li key={group.label} className={styles.group}>
            <p className={styles.groupLabel}>{group.label}</p>
            <p className={styles.groupDescription}>{group.description}</p>
            {/* biome-ignore lint/a11y/useSemanticElements: fieldset は既定のスタイルの打ち消しが多くなるため使わない */}
            <div
              role="group"
              aria-label={group.label}
              className={styles.operations}
            >
              {group.operations.map(({ operation, label }) => (
                <Checkbox
                  key={operation}
                  isSelected={checked.has(operation)}
                  onChange={(value) => toggle(operation, value)}
                >
                  {label}
                </Checkbox>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
