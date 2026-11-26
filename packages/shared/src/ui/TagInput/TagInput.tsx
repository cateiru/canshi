"use client";

import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { ComboBox, Input, ListBox, Popover } from "react-aria-components";
import { TbX } from "react-icons/tb";
import { ListBoxOption } from "../ListBoxOption/ListBoxOption";
import styles from "./TagInput.module.css";

export type TagInputProps = {
  label: string;
  /** 付いているタグ。付けた順に並べる */
  value: readonly string[];
  onChange: (value: string[]) => void;
  /** 入力の候補。付いているタグは候補に出さない */
  suggestions?: readonly string[];
  /**
   * 指定すると、タグごとにこの名前でフォームに送る。確定していない入力途中の文字も、
   * 入力し忘れたものとして一緒に送る
   */
  name?: string;
  /** フォームに送る値を、タグの文字から作る。省略すると、タグの文字をそのまま送る */
  getFormValue?: (tag: string) => string;
  placeholder?: string;
  /** 1 つのタグの文字数の上限 */
  maxLength?: number;
  /** 入力欄の下に添える補足説明。読み上げでも入力欄の説明として伝わる */
  description?: ReactNode;
  errorMessage?: string;
  isDisabled?: boolean;
  className?: string;
};

/** 候補のうち、入力した文字で新しいタグを作るもの。ほかの候補と ID が重ならないよう接頭辞を付ける */
const CREATE_ID = "create";
const SUGGESTION_ID_PREFIX = "suggestion:";

/**
 * 自由な文字をタグとして複数付けられる入力欄。
 * 文字を入力して Enter（または候補）でタグを付け、タグの × か、入力が空のときの Backspace で外す
 */
export function TagInput({
  label,
  value,
  onChange,
  suggestions = [],
  name,
  getFormValue = (tag) => tag,
  placeholder,
  maxLength,
  description,
  errorMessage,
  isDisabled = false,
  className,
}: TagInputProps) {
  const labelId = useId();
  const inputId = useId();
  const descriptionId = useId();
  const errorId = useId();
  const controlRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const tagListRef = useRef<HTMLUListElement>(null);
  const [inputValue, setInputValue] = useState("");
  // タグを付け外ししたことを読み上げる文
  const [announcement, setAnnouncement] = useState("");
  // 候補の幅。ComboBox の既定では文字の入力の幅になり、タグと同じ行に並ぶと狭くなるため、枠の幅に揃える
  const [menuWidth, setMenuWidth] = useState<number>();
  // × をキーボードで押したときに、次にフォーカスするタグの位置
  const focusIndexAfterRemove = useRef<number | null>(null);

  const typed = inputValue.trim();
  const remaining = suggestions.filter(
    (suggestion) =>
      !value.includes(suggestion) &&
      suggestion.toLowerCase().includes(typed.toLowerCase()),
  );
  const canCreate =
    typed !== "" && !value.includes(typed) && !remaining.includes(typed);
  const options = [
    ...remaining.map((suggestion) => ({
      id: `${SUGGESTION_ID_PREFIX}${suggestion}`,
      label: suggestion,
    })),
    ...(canCreate ? [{ id: CREATE_ID, label: `「${typed}」を追加` }] : []),
  ];

  const submittedTags =
    typed === "" || value.includes(typed) ? value : [...value, typed];

  useEffect(() => {
    const index = focusIndexAfterRemove.current;
    if (index === null) {
      return;
    }
    focusIndexAfterRemove.current = null;
    const buttons = tagListRef.current?.querySelectorAll("button") ?? [];
    (buttons[Math.min(index, buttons.length - 1)] ?? inputRef.current)?.focus();
  });

  const addTag = (tag: string) => {
    setInputValue("");
    if (tag === "" || value.includes(tag)) {
      return;
    }
    onChange([...value, tag]);
    setAnnouncement(`「${tag}」を追加しました`);
  };

  const removeTag = (tag: string) => {
    onChange(value.filter((current) => current !== tag));
    setAnnouncement(`「${tag}」を外しました`);
  };

  // Enter をフォームの送信や ComboBox の確定に使わせず、入力した文字をタグにする
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== inputRef.current) {
      return;
    }
    // 変換中の Enter・Backspace などは変換の操作に使い、ComboBox にも渡さない（渡すと、Safari で変換を
    // 確定したときに候補が閉じる）。Safari は変換を確定する Enter を、変換が終わった後の
    // keyCode 229 のキー入力として送る
    if (event.nativeEvent.isComposing || event.keyCode === 229) {
      event.stopPropagation();
      return;
    }
    if (event.key === "Enter") {
      // 矢印キーで候補を選んでいるときは、ComboBox に候補を確定させる
      if (inputRef.current.getAttribute("aria-activedescendant")) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      addTag(typed);
    } else if (
      event.key === "Backspace" &&
      inputValue === "" &&
      value.length > 0 &&
      !event.repeat
    ) {
      removeTag(value[value.length - 1]);
    }
  };

  const describedBy = [
    description ? descriptionId : null,
    errorMessage ? errorId : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={[styles.field, className].filter(Boolean).join(" ")}>
      <label id={labelId} htmlFor={inputId} className={styles.label}>
        {label}
      </label>
      <div
        ref={controlRef}
        className={styles.control}
        data-invalid={errorMessage ? true : undefined}
        data-disabled={isDisabled || undefined}
        onKeyDownCapture={handleKeyDown}
      >
        {value.length > 0 ? (
          <ul
            ref={tagListRef}
            className={styles.tags}
            aria-label={`選択中の${label}`}
          >
            {value.map((tag, index) => (
              <li key={tag} className={styles.tag}>
                <span className={styles.tagName}>{tag}</span>
                <button
                  type="button"
                  className={styles.remove}
                  aria-label={`「${tag}」を外す`}
                  disabled={isDisabled}
                  onClick={(event) => {
                    // キーボードで押したときだけ、消えるボタンの代わりに次のタグへフォーカスを移す
                    // （タッチのときに入力欄へ移すと、ソフトウェアキーボードが開いてしまう）
                    if (event.detail === 0) {
                      focusIndexAfterRemove.current = index;
                    }
                    removeTag(tag);
                  }}
                >
                  <TbX aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <ComboBox
          className={styles.comboBox}
          aria-labelledby={labelId}
          aria-describedby={describedBy || undefined}
          items={options}
          inputValue={inputValue}
          onInputChange={setInputValue}
          // 選んだ候補はタグにし、ComboBox では選択中にしない
          selectedKey={null}
          onSelectionChange={(key) => {
            if (key === CREATE_ID) {
              addTag(typed);
            } else if (typeof key === "string") {
              addTag(key.slice(SUGGESTION_ID_PREFIX.length));
            }
          }}
          onOpenChange={(isOpen) => {
            if (isOpen) {
              setMenuWidth(controlRef.current?.offsetWidth);
            }
          }}
          allowsCustomValue
          menuTrigger="focus"
          isInvalid={!!errorMessage}
          // エラーは呼び出し側の検証の結果のため、ブラウザの検証にはせず、直した後の送信を止めない
          validationBehavior="aria"
          isDisabled={isDisabled}
        >
          <Input
            ref={inputRef}
            id={inputId}
            className={styles.input}
            placeholder={value.length === 0 ? placeholder : undefined}
            maxLength={maxLength}
            enterKeyHint="done"
          />
          <Popover
            triggerRef={controlRef}
            className={styles.popover}
            style={{ width: menuWidth }}
          >
            <ListBox className={styles.listbox}>
              {(option: (typeof options)[number]) => (
                <ListBoxOption id={option.id} label={option.label} />
              )}
            </ListBox>
          </Popover>
        </ComboBox>
      </div>
      {name
        ? submittedTags.map((tag) => (
            <input
              key={tag}
              type="hidden"
              name={name}
              value={getFormValue(tag)}
              disabled={isDisabled}
            />
          ))
        : null}
      {description ? (
        <p id={descriptionId} className={styles.description}>
          {description}
        </p>
      ) : null}
      {errorMessage ? (
        <p id={errorId} className={styles.errorMessage}>
          {errorMessage}
        </p>
      ) : null}
      {/* 候補を開いている間、ComboBox は入力欄と候補の外を読み上げから隠すため、隠さないようにする */}
      <p role="status" data-live-announcer="true" className={styles.srOnly}>
        {announcement}
      </p>
    </div>
  );
}
