"use client";

import {
  Slider as AriaSlider,
  type SliderProps as AriaSliderProps,
  Label,
  SliderFill,
  SliderOutput,
  SliderThumb,
  SliderTrack,
} from "react-aria-components";
import styles from "./Slider.module.css";

export type SliderProps = Omit<AriaSliderProps<number>, "children"> & {
  label: string;
  /** 値の表示形式を指定する。省略時は数値をそのまま表示する */
  formatValue?: (value: number) => string;
};

export function Slider({
  label,
  formatValue,
  className,
  ...props
}: SliderProps) {
  const classes = [styles.slider, className].filter(Boolean).join(" ");

  return (
    <AriaSlider className={classes} {...props}>
      <div className={styles.header}>
        <Label className={styles.label}>{label}</Label>
        <SliderOutput className={styles.output}>
          {({ state }) =>
            formatValue ? formatValue(state.values[0]) : state.values[0]
          }
        </SliderOutput>
      </div>
      <SliderTrack className={styles.track}>
        {/* SliderFill は既定で height: 100%（トラックの高さ＝タップ領域）を
            付けるため、見た目の細いバーに合わせて上書きする */}
        <SliderFill className={styles.fill} style={{ height: 4 }} />
        <SliderThumb className={styles.thumb} />
      </SliderTrack>
    </AriaSlider>
  );
}
