"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  TbArrowRight,
  TbCheck,
  TbChevronRight,
  TbSquare,
  TbSquareCheck,
  TbX,
} from "react-icons/tb";
import { addToast, Button, ButtonLink } from "@/components/ui";
import { ScaledIcon } from "@/components/ui/ScaledIcon/ScaledIcon";
import {
  canLeaveTourStep,
  isTourHiddenPath,
  isTourStepDone,
  isTourStepPage,
  nextTourPosition,
  TOUR_STEPS,
  type TourStep,
  type TourView,
  tourPresetHref,
  tourScheduleHref,
  tourStepHref,
} from "../domain/tour";
import {
  advanceTourAction,
  getTourViewAction,
  quitTourAction,
} from "./actions";
import styles from "./TourGuide.module.css";

type StepContent = {
  /** 進み具合の表示と、次のステップへ進むボタンに使う短い名前 */
  label: string;
  title: string;
  description: string;
  /** 登録を終えたあとの見出しと、次のステップへの案内 */
  doneTitle: string;
  doneDescription: string;
  /** 登録画面へのリンクの文言 */
  linkLabel: string;
  /** 登録画面で出す、入力の案内 */
  pageHint: string;
};

const STEP_CONTENT: Record<TourStep, StepContent> = {
  household: {
    label: "家の作成",
    title: "家を作成しましょう",
    description:
      "CANSHI では、ねこや記録を「家」ごとにまとめます。まずは家を作成してください。家族はあとから招待できます。",
    doneTitle: "家の準備ができました",
    doneDescription:
      "ねこや記録は、この家にまとめられます。次は、ねこを登録しましょう。",
    linkLabel: "家の作成へ進む",
    pageHint: "家の名前を入力して「家を作成する」を押してください。",
  },
  cat: {
    label: "ねこの登録",
    title: "ねこを登録しましょう",
    description:
      "名前や誕生日を登録すると、ごはんや体調の記録をはじめられます。",
    doneTitle: "ねこを登録しました",
    doneDescription: "次は、ふだんあげているごはんを登録しましょう。",
    linkLabel: "ねこの登録へ進む",
    pageHint: "名前などを入力して「登録する」を押してください。",
  },
  food: {
    label: "ごはんの登録",
    title: "ごはんを登録しましょう",
    description:
      "ふだんあげているごはんの商品を登録すると、ごはんの記録でカロリーを自動で計算できます。",
    doneTitle: "ごはんを登録しました",
    doneDescription: "次は、ごはんの時間とプリセットを登録しましょう。",
    linkLabel: "ごはんの登録へ進む",
    pageHint:
      "共通のごはん商品から探すか、手動で入力して、ごはんを登録してください。",
  },
  feeding: {
    label: "ごはんの時間・プリセット",
    title: "ごはんの時間・プリセットを登録しましょう",
    description:
      "ごはんの時間を登録すると、その時間にお知らせが届きます。ごはんプリセットは、よくあげるごはんの組み合わせを登録して、記録を手早くする機能です。",
    doneTitle: "ごはんの時間・プリセットを登録しました",
    doneDescription: "どちらも登録しました。ガイドを完了してください。",
    linkLabel: "ごはんの時間の登録へ進む",
    pageHint:
      "この画面で登録できます。登録するとチェックが付きます。どちらか一方だけでもかまいません。",
  },
};

type TourGuideProps = {
  /** サーバーで求めた状態。Cookie を書き換える操作（次へ・やめる）のあとは新しい値が渡される */
  view: TourView;
};

/**
 * はじめてガイドのパネル。ヘッダーの下に出し、今のステップの登録画面へ案内する。
 * 登録を終えると「次へ」を出し、家の作成以外はスキップできる。いつでもやめられる
 */
export function TourGuide({ view: serverView }: TourGuideProps) {
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  // ページを移ったあとに読み直した状態。サーバーから新しい状態が渡されたら、古い読み直しは捨てる
  const [refreshed, setRefreshed] = useState<{
    base: TourView;
    view: TourView | null;
  } | null>(null);
  const view = refreshed?.base === serverView ? refreshed.view : serverView;

  // 登録を終えて別のページへ移ったときに、登録済みの表示へ変える。レイアウトはページの移動では
  // 描き直されないことがあるため、移動のたびに読み直す（最初の表示はサーバーの状態をそのまま使う）
  const lastPathname = useRef(pathname);
  useEffect(() => {
    if (lastPathname.current === pathname) {
      return;
    }
    lastPathname.current = pathname;
    let ignore = false;
    getTourViewAction()
      .then((next) => {
        if (!ignore) {
          setRefreshed({ base: serverView, view: next });
        }
      })
      // 読み直せなくても、今の表示のまま使える
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, [pathname, serverView]);

  if (!view || isTourHiddenPath(pathname)) {
    return null;
  }

  const quit = (message?: string) => {
    startTransition(async () => {
      await quitTourAction();
      if (message) {
        addToast({ title: message, color: "info" });
      }
    });
  };

  if (view.position === "done") {
    return (
      <Panel>
        <h2 className={styles.title}>
          <ScaledIcon
            icon={TbCheck}
            aria-hidden="true"
            size={20}
            className={styles.doneIcon}
          />
          準備ができました
        </h2>
        <p className={styles.description}>
          はじめてガイドはこれで終わりです。ねこのページから、毎日の記録をはじめましょう。ガイドは、ヘルプからいつでももう一度はじめられます。
        </p>
        <div className={styles.actions}>
          <Button
            variant="primary"
            isDisabled={isPending}
            onPress={() => quit()}
          >
            ガイドを閉じる
          </Button>
        </div>
      </Panel>
    );
  }

  const step = view.position;
  const content = STEP_CONTENT[step];
  const stepNumber = TOUR_STEPS.indexOf(step) + 1;
  const isDone = isTourStepDone(step, view.progress);
  // ごはんの時間・プリセットは、チェックリストの両方にチェックが付いたら登録を終えた表示にする
  const isComplete =
    step === "feeding"
      ? view.progress.schedule && view.progress.preset
      : isDone;
  const onStepPage = isTourStepPage(step, pathname);
  const next = nextTourPosition(step);
  const advance = () => {
    startTransition(async () => {
      await advanceTourAction(step);
    });
  };

  return (
    <Panel>
      <div className={styles.header}>
        <p className={styles.progress}>
          <span className={styles.name}>はじめてガイド</span>
          <span>
            ステップ {stepNumber} / {TOUR_STEPS.length}
          </span>
        </p>
        <Button
          variant="ghost"
          className={styles.quit}
          leftIcon={TbX}
          aria-label="ガイドをやめる"
          isDisabled={isPending}
          onPress={() =>
            quit("はじめてガイドをやめました。ヘルプからいつでも再開できます。")
          }
        >
          やめる
        </Button>
      </div>
      <ol className={styles.steps} aria-label="ガイドの進み具合">
        {TOUR_STEPS.map((item, index) => (
          <li
            key={item}
            className={[
              styles.step,
              index + 1 < stepNumber && styles.stepPast,
              index + 1 === stepNumber && styles.stepCurrent,
            ]
              .filter(Boolean)
              .join(" ")}
            aria-current={index + 1 === stepNumber ? "step" : undefined}
          >
            <span className={styles.visuallyHidden}>
              {STEP_CONTENT[item].label}
            </span>
          </li>
        ))}
      </ol>

      <h2 className={styles.title}>
        {isComplete ? (
          <ScaledIcon
            icon={TbCheck}
            aria-hidden="true"
            size={20}
            className={styles.doneIcon}
          />
        ) : null}
        {isComplete ? content.doneTitle : content.title}
      </h2>
      <p className={styles.description}>
        {stepDescription(content, isComplete, onStepPage)}
      </p>

      {step === "feeding" ? (
        <ul className={styles.checklist}>
          <li>
            <ChecklistLink
              href={tourScheduleHref(view.householdId)}
              isChecked={view.progress.schedule}
            >
              ごはんの時間を登録する
            </ChecklistLink>
          </li>
          <li>
            <ChecklistLink
              href={tourPresetHref(view.householdId)}
              isChecked={view.progress.preset}
            >
              ごはんプリセットを登録する
            </ChecklistLink>
          </li>
        </ul>
      ) : null}

      <div className={styles.actions}>
        {step !== "feeding" && !isDone && !onStepPage ? (
          <ButtonLink
            href={tourStepHref(step, view.householdId)}
            variant="primary"
            rightIcon={TbArrowRight}
          >
            {content.linkLabel}
          </ButtonLink>
        ) : null}
        {canLeaveTourStep(step, view.progress) ? (
          <Button
            variant={isDone ? "primary" : "secondary"}
            isDisabled={isPending}
            onPress={advance}
          >
            {advanceLabel(isDone, next)}
          </Button>
        ) : null}
      </div>
    </Panel>
  );
}

/** ステップの説明。登録を終えたら次のステップへの案内、登録画面では入力の案内にする */
function stepDescription(
  content: StepContent,
  isDone: boolean,
  onStepPage: boolean,
) {
  if (isDone) {
    return content.doneDescription;
  }
  return onStepPage ? content.pageHint : content.description;
}

/** 次へ進むボタンの文言。登録していなければスキップ、最後のステップでは完了にする */
function advanceLabel(
  isDone: boolean,
  next: ReturnType<typeof nextTourPosition>,
) {
  if (next === "done") {
    return isDone ? "ガイドを完了する" : "スキップして完了する";
  }
  return isDone ? `次へ：${STEP_CONTENT[next].label}` : "スキップする";
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.wrapper}>
      <section aria-label="はじめてガイド" className={styles.panel}>
        {children}
      </section>
    </div>
  );
}

/**
 * チェックリストの 1 行。登録画面へのリンクで、登録済みならチェックを付ける。
 * チェックは登録の有無から決まり、押して切り替えるものではないため、checkbox にはしない
 */
function ChecklistLink({
  href,
  isChecked,
  children,
}: {
  href: string;
  isChecked: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={[styles.checkItem, isChecked && styles.checkItemChecked]
        .filter(Boolean)
        .join(" ")}
    >
      <ScaledIcon
        icon={isChecked ? TbSquareCheck : TbSquare}
        aria-hidden="true"
        size={20}
        className={styles.checkBox}
      />
      <span className={styles.checkLabel}>
        {children}
        <span className={styles.checkStatus}>
          {isChecked ? "登録済み" : "未登録"}
        </span>
      </span>
      <ScaledIcon
        icon={TbChevronRight}
        aria-hidden="true"
        size={16}
        className={styles.checkArrow}
      />
    </Link>
  );
}
