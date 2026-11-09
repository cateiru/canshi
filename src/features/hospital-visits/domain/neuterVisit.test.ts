import { describe, expect, it } from "vitest";
import { isNeuterVisitReason } from "./neuterVisit";

describe("isNeuterVisitReason", () => {
  it.each(["去勢", "避妊", "去勢手術", "避妊手術の抜糸", "術前検査（避妊）"])(
    "「%s」は避妊・去勢の通院とみなす",
    (reason) => {
      expect(isNeuterVisitReason(reason)).toBe(true);
    },
  );

  it.each(["ワクチン接種", "定期健診", ""])(
    "「%s」は避妊・去勢の通院とみなさない",
    (reason) => {
      expect(isNeuterVisitReason(reason)).toBe(false);
    },
  );
});
