import { z } from "zod";

/**
 * チェックを外した Checkbox は FormData に一切含まれない（`formData.get(name)` が null になる）ため、
 * `"on"` かどうかで真偽値に変換する。
 */
export const checkboxBooleanSchema = z.preprocess(
  (value) => value === "on",
  z.boolean(),
);
