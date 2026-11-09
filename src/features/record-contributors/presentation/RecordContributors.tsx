import { TbRobot } from "react-icons/tb";
import { MCP_CLIENT_APP_ICON } from "@/features/mcp/presentation/clientIcons";
import { UserAvatar } from "@/features/users/presentation/UserAvatar";
import {
  formatRecordContributorLabel,
  type RecordContributor,
} from "../domain/contributor";
import styles from "./RecordContributors.module.css";

/** 並べて表示するアイコンの最大数。超えた分は「+N」にまとめる */
export const MAX_VISIBLE_CONTRIBUTORS = 3;

type RecordContributorsProps = {
  /** 作成・編集した人（最初に操作した順）。無い・空なら何も表示しない */
  contributors: readonly RecordContributor[] | undefined;
};

/**
 * 記録を作成・編集した人のアイコンを、半分ほど重ねて並べる。最大 3 名まで表示し、
 * 残りは「+N」にまとめる。名前はツールチップ（title）と読み上げで伝える。
 * AI との接続からの操作は、アプリのアイコン（わからないアプリはロボット）で表示する
 */
export function RecordContributors({ contributors }: RecordContributorsProps) {
  if (!contributors || contributors.length === 0) {
    return null;
  }
  const visible = contributors.slice(0, MAX_VISIBLE_CONTRIBUTORS);
  const hiddenCount = contributors.length - visible.length;
  const labels = contributors.map(formatRecordContributorLabel);
  const hiddenLabel = labels.slice(MAX_VISIBLE_CONTRIBUTORS).join("、");

  return (
    <ul className={styles.group} aria-label="作成・編集した人">
      {visible.map((contributor, index) => (
        <li
          // 同じ記録の中で順番は変わらないため、順番をキーにする
          // biome-ignore lint/suspicious/noArrayIndexKey: 接続の ID を画面に渡さないため
          key={index}
          className={styles.item}
          title={labels[index]}
        >
          <ContributorAvatar contributor={contributor} label={labels[index]} />
        </li>
      ))}
      {hiddenCount > 0 ? (
        <li className={styles.item} title={hiddenLabel}>
          <span className={styles.more} aria-hidden="true">
            +{hiddenCount}
          </span>
          <span className={styles.srOnly}>
            ほか{hiddenCount}名：{hiddenLabel}
          </span>
        </li>
      ) : null}
    </ul>
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
