import { describe, expect, it } from "vitest";
import {
  normalizeRecordExportTypes,
  RECORD_EXPORT_STALE_AFTER_MS,
  RECORD_EXPORT_TYPES,
  recordExportDisplayStatus,
  recordExportFailureMessage,
  recordExportFileName,
  recordExportObjectKey,
} from "./recordExport";
import { recordExportFormSchema } from "./schema";

describe("normalizeRecordExportTypes", () => {
  it("知らない種類と重複を除き、RECORD_EXPORT_TYPES の順に並べる", () => {
    expect(
      normalizeRecordExportTypes(["memo", "poop", "unknown", "poop", 1]),
    ).toEqual(["poop", "memo"]);
  });
});

describe("recordExportDisplayStatus", () => {
  const now = new Date("2026-11-22T12:00:00Z");

  it("完了・失敗はそのまま", () => {
    expect(
      recordExportDisplayStatus({ status: "completed", createdAt: now }, now),
    ).toBe("completed");
    expect(
      recordExportDisplayStatus({ status: "failed", createdAt: now }, now),
    ).toBe("failed");
  });

  it("処理中は、止まったとみなす時間を過ぎるまで処理中", () => {
    const justBefore = new Date(
      now.getTime() - RECORD_EXPORT_STALE_AFTER_MS + 1000,
    );
    expect(
      recordExportDisplayStatus(
        { status: "pending", createdAt: justBefore },
        now,
      ),
    ).toBe("running");
    expect(
      recordExportDisplayStatus(
        { status: "processing", createdAt: justBefore },
        now,
      ),
    ).toBe("running");
  });

  it("処理中のまま止まったとみなす時間を過ぎたものは失敗にする", () => {
    const stale = new Date(now.getTime() - RECORD_EXPORT_STALE_AFTER_MS - 1000);
    expect(
      recordExportDisplayStatus(
        { status: "processing", createdAt: stale },
        now,
      ),
    ).toBe("failed");
  });
});

describe("recordExportFailureMessage", () => {
  it("大きすぎるときは、写真・動画を含めないように案内する", () => {
    expect(recordExportFailureMessage("too_large")).toContain(
      "写真・動画を含めずに",
    );
    expect(recordExportFailureMessage("error")).toContain("もう一度");
    expect(recordExportFailureMessage(null)).toContain("もう一度");
  });
});

describe("recordExportObjectKey・recordExportFileName", () => {
  it("記録のメディアと重ならないキーにする", () => {
    expect(recordExportObjectKey("abc")).toBe("record_exports/abc.zip");
  });

  it("ファイル名は依頼した日時（日本時間）の英数字にする", () => {
    expect(recordExportFileName(new Date("2026-11-22T15:04:59Z"))).toBe(
      "canshi-records-20261123-0004.zip",
    );
  });
});

describe("recordExportFormSchema", () => {
  it("記録の種類を並べ替え、写真・動画のチェックを真偽値にする", () => {
    expect(
      recordExportFormSchema.parse({
        recordTypes: ["memo", "feeding"],
        includeMedia: "on",
      }),
    ).toEqual({ recordTypes: ["feeding", "memo"], includeMedia: true });
    expect(
      recordExportFormSchema.parse({
        recordTypes: [...RECORD_EXPORT_TYPES],
        includeMedia: null,
      }),
    ).toEqual({ recordTypes: [...RECORD_EXPORT_TYPES], includeMedia: false });
  });

  it("記録の種類を 1 つも選ばなければエラー", () => {
    const result = recordExportFormSchema.safeParse({
      recordTypes: [],
      includeMedia: null,
    });
    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.recordTypes).toEqual([
      "出力する記録を 1 つ以上選んでください",
    ]);
  });

  it("知らない記録の種類が含まれていればエラー", () => {
    const result = recordExportFormSchema.safeParse({
      recordTypes: ["poop", "cats"],
      includeMedia: null,
    });
    expect(result.success).toBe(false);
  });
});
