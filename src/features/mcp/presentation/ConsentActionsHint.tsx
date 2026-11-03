"use client";

import { useEffect, useState } from "react";
import { TbArrowDown } from "react-icons/tb";
import { Button } from "@/components/ui";
import styles from "./ConsentActionsHint.module.css";

type ConsentActionsHintProps = {
  /** 「許可する」「許可しない」のボタンを囲む要素の id */
  targetId: string;
};

/**
 * 同意画面で、「許可する」「許可しない」のボタンが画面より下にあるあいだ、画面の下の中央に
 * 浮かせて表示するボタン。許可する範囲が長くてもボタンが下にあることが分かるようにし、押すと
 * ボタンまでスクロールする。ボタンが画面に入ると隠す。
 * 誤って許可しないよう、押してもスクロールするだけで、許可のボタンにはフォーカスを移さない
 */
export function ConsentActionsHint({ targetId }: ConsentActionsHintProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const target = document.getElementById(targetId);
    if (!target || typeof IntersectionObserver === "undefined") {
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      // ボタンより下までスクロールしたときは、上にあるため案内しない
      setIsVisible(!entry.isIntersecting && entry.boundingClientRect.top > 0);
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, [targetId]);

  if (!isVisible) {
    return null;
  }

  return (
    <div className={styles.container}>
      <Button
        variant="primary"
        className={styles.button}
        leftIcon={TbArrowDown}
        onPress={() => {
          const reduceMotion = window.matchMedia(
            "(prefers-reduced-motion: reduce)",
          ).matches;
          document.getElementById(targetId)?.scrollIntoView({
            behavior: reduceMotion ? "auto" : "smooth",
            block: "center",
          });
        }}
      >
        許可するボタンへ
      </Button>
    </div>
  );
}
