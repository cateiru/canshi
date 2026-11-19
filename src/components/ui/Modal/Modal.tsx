"use client";

import type { ReactNode } from "react";
import {
  Modal as AriaModal,
  Dialog,
  Heading,
  ModalOverlay,
} from "react-aria-components";
import { TbX } from "react-icons/tb";
import { IconButton } from "../Button/IconButton";
import { CatEarFrame } from "../CatEarFrame/CatEarFrame";
import styles from "./Modal.module.css";

export type ModalSize = "md" | "lg";

export type ModalProps = {
  open: boolean;
  title?: ReactNode;
  onClose: () => void;
  /** md: 確認ダイアログ向け（既定）。lg: 画像・動画の表示など幅を広く使う用途向け */
  size?: ModalSize;
  /**
   * 外側を押す・Escape キーで閉じられるか（既定は閉じられる）。false のときは、中のボタンで
   * 選ぶまで閉じない
   */
  isDismissable?: boolean;
  /**
   * 指定すると、右上に閉じるボタン（✕）を出し、押したときに `onClose` を呼ぶ。
   * 値はボタンの読み上げ用のラベル
   */
  closeButtonLabel?: string;
  children: ReactNode;
};

export function Modal({
  open,
  title,
  onClose,
  size = "md",
  isDismissable = true,
  closeButtonLabel,
  children,
}: ModalProps) {
  const heading = title ? (
    <Heading slot="title" className={styles.title}>
      {title}
    </Heading>
  ) : null;

  return (
    <ModalOverlay
      isOpen={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onClose();
        }
      }}
      isDismissable={isDismissable}
      isKeyboardDismissDisabled={!isDismissable}
      className={styles.overlay}
    >
      <AriaModal className={`${styles.modal} ${styles[size]}`}>
        <Dialog className={styles.dialog}>
          <CatEarFrame className={styles.panel}>
            <div className={styles.scrollArea}>
              {closeButtonLabel ? (
                <div className={styles.header}>
                  {heading}
                  <IconButton
                    icon={TbX}
                    aria-label={closeButtonLabel}
                    className={styles.closeButton}
                    onPress={onClose}
                  />
                </div>
              ) : (
                heading
              )}
              {children}
            </div>
          </CatEarFrame>
        </Dialog>
      </AriaModal>
    </ModalOverlay>
  );
}
