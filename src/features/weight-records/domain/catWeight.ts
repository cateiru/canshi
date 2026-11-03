import type { WeightRecord } from "@/db/schema";
import { calculateCatWeightKg } from "./calculations";

/**
 * 猫の体重の測り方（値オブジェクト）。猫の体重を直接量ったか、猫を抱いて量った合計から
 * 人の体重を引いたか。猫の体重はここから求める
 */
export type CatWeightMeasurement = Readonly<
  | { inputMethod: "auto"; combinedWeightKg: number; humanWeightKg: number }
  | {
      inputMethod: Exclude<WeightRecord["inputMethod"], "auto">;
      catWeightKg: number;
    }
>;

/** 猫の体重（kg）。抱いて量ったときは、合計 − 人の体重 */
export function catWeightKg(measurement: CatWeightMeasurement): number {
  if (measurement.inputMethod === "auto") {
    return calculateCatWeightKg(
      measurement.combinedWeightKg,
      measurement.humanWeightKg,
    );
  }
  return measurement.catWeightKg;
}

/**
 * 入力から測り方を作る。抱いて量ったときは合計と人の体重が、直接量ったときは猫の体重が
 * あることを、フォームの規則（`./schema.ts`）で確かめてある
 */
export function catWeightMeasurementFrom(data: {
  inputMethod: WeightRecord["inputMethod"];
  combinedWeightKg?: number;
  humanWeightKg?: number;
  catWeightKg?: number;
}): CatWeightMeasurement {
  if (data.inputMethod === "auto") {
    return {
      inputMethod: "auto",
      combinedWeightKg: data.combinedWeightKg as number,
      humanWeightKg: data.humanWeightKg as number,
    };
  }
  return {
    inputMethod: data.inputMethod,
    catWeightKg: data.catWeightKg as number,
  };
}
