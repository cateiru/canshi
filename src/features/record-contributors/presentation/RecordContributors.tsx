"use client";

import { useState } from "react";
import { Button as AriaButton } from "react-aria-components";
import { TbRobot } from "react-icons/tb";
import { Button, Modal } from "@/components/ui";
import { MCP_CLIENT_APP_ICON } from "@/features/mcp/presentation/clientIcons";
import { formatTimestampJst } from "@/features/shared/datetime";
import { UserAvatar } from "@/features/users/presentation/UserAvatar";
import {
  formatRecordContributorLabel,
  type RecordContributions,
  type RecordContributor,
} from "../domain/contributor";
import styles from "./RecordContributors.module.css";

/** 並べて表示するアイコンの最大数。超えた分は「+N」にまとめる */
export const MAX_VISIBLE_CONTRIBUTORS = 2;

type RecordContributorsProps = {
  /** 作成・編集した人と履歴。無い・空なら何も表示しない */
  contributors: RecordContributions | undefined;
};

/**
 * 記録を作成・編集した人のアイコンを、半分ほど重ねて並べる。最大 2 名まで表示し、
 * 残りは「+N」にまとめる。名前はツールチップ（title）と読み上げで伝える。
 * AI との接続からの操作は、アプリのアイコン（わからないアプリはロボット）で表示する。
 * アイコンを押すと、作成・編集の履歴をモーダルで表示する
 */
export function RecordContributors({ contributors }: RecordContributorsProps) {
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  if (!contributors || contributors.contributors.length === 0) {
    return null;
  }
  const people = contributors.contributors;
  const visible = people.slice(0, MAX_VISIBLE_CONTRIBUTORS);
  const hiddenCount = people.length - visible.length;
  const labels = people.map(formatRecordContributorLabel);
  const hiddenLabel = labels.slice(MAX_VISIBLE_CONTRIBUTORS).join("、");

  return (
    <>
      <AriaButton
        className={styles.trigger}
        aria-label={`編集履歴を見る（作成・編集した人：${labels.join("、")}）`}
        aria-haspopup="dialog"
        onPress={() => setIsHistoryOpen(true)}
      >
        <span className={styles.group}>
          {visible.map((contributor, index) => (
            <span
              // 同じ記録の中で順番は変わらないため、順番をキーにする
              // biome-ignore lint/suspicious/noArrayIndexKey: 接続の ID を画面に渡さないため
              key={index}
              className={styles.item}
              title={labels[index]}
            >
              <ContributorAvatar
                contributor={contributor}
                label={labels[index]}
              />
            </span>
          ))}
          {hiddenCount > 0 ? (
            <span
              className={`${styles.item} ${styles.moreItem}`}
              title={hiddenLabel}
            >
              <span className={styles.more}>+{hiddenCount}</span>
            </span>
          ) : null}
        </span>
      </AriaButton>
      <Modal
        open={isHistoryOpen}
        title="編集履歴"
        onClose={() => setIsHistoryOpen(false)}
      >
        <RecordChangeHistory contributions={contributors} labels={labels} />
        <div className={styles.actions}>
          <Button variant="secondary" onPress={() => setIsHistoryOpen(false)}>
            閉じる
          </Button>
        </div>
      </Modal>
    </>
  );
}

/**
 * 作成・編集の履歴。新しい保存を上に並べ、作成した人が一番下になる
 */
function RecordChangeHistory({
  contributions,
  labels,
}: {
  contributions: RecordContributions;
  labels: readonly string[];
}) {
  const entries = contributions.history
    .map((entry, index) => ({ ...entry, index }))
    .reverse();

  return (
    <ol className={styles.history} aria-label="編集履歴（新しい順）">
      {entries.map(({ contributorIndex, changedAt, index }) => {
        const contributor = contributions.contributors[contributorIndex];
        if (!contributor) {
          return null;
        }
        const label = labels[contributorIndex];
        return (
          // 履歴は追加されるだけで並びは変わらないため、古い順の添字をキーにする
          <li key={index} className={styles.historyItem}>
            <span className={styles.historyAvatar} aria-hidden="true">
              <ContributorAvatar contributor={contributor} label={label} />
            </span>
            <span className={styles.historyText}>
              <span className={styles.historyName}>{label}</span>
              <time
                className={styles.historyTime}
                dateTime={changedAt.toISOString()}
              >
                {formatTimestampJst(changedAt)}
              </time>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function ContributorAvatar({
  contributor,
  label,
}: {
  contributor: RecordContributor;
  label: string;
}) {
  if (contributor.kind === "user") {
    return (
      <UserAvatar
        name={contributor.userName}
        iconMediaAssetId={contributor.iconMediaAssetId}
        size="xs"
      />
    );
  }
  const Icon = contributor.app ? MCP_CLIENT_APP_ICON[contributor.app] : TbRobot;
  return (
    <span role="img" aria-label={label} className={styles.ai}>
      <Icon aria-hidden="true" size="60%" />
    </span>
  );
}
