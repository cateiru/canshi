import { describe, expect, it } from "vitest";
import { formatCsv } from "./csv";

describe("formatCsv", () => {
  it("先頭に BOM を付け、CRLF で区切る", () => {
    expect(
      formatCsv({
        columns: ["ID", "ねこ"],
        rows: [
          ["1", "たま"],
          ["2", "みけ"],
        ],
      }),
    ).toBe("\uFEFFID,ねこ\r\n1,たま\r\n2,みけ\r\n");
  });

  it("カンマ・ダブルクォート・改行を含むセルはダブルクォートで囲む", () => {
    expect(
      formatCsv({
        columns: ["備考"],
        rows: [["a,b"], ['"よく"食べた'], ["1行目\n2行目"], ["あ\r\n"]],
      }),
    ).toBe(
      '\uFEFF備考\r\n"a,b"\r\n"""よく""食べた"\r\n"1行目\n2行目"\r\n"あ\r\n"\r\n',
    );
  });

  it("null・undefined・有限でない数は空のセルにし、数はそのまま書く", () => {
    expect(
      formatCsv({
        columns: ["a", "b", "c", "d", "e"],
        rows: [[null, undefined, Number.NaN, 0, 12.5]],
      }),
    ).toBe("\uFEFFa,b,c,d,e\r\n,,,0,12.5\r\n");
  });

  it("表計算ソフトが数式として解釈する文字で始まる文字列は、先頭に ' を付ける", () => {
    expect(
      formatCsv({
        columns: ["備考"],
        rows: [
          ["=1+1"],
          ["+81"],
          ["-少し吐いた"],
          ["@SUM(A1)"],
          ["\tタブ"],
          ['=HYPERLINK("x")'],
        ],
      }),
    ).toBe(
      "\uFEFF備考\r\n'=1+1\r\n'+81\r\n'-少し吐いた\r\n'@SUM(A1)\r\n'\tタブ\r\n\"'=HYPERLINK(\"\"x\"\")\"\r\n",
    );
  });

  it("数のセルは負の数でも ' を付けない", () => {
    expect(formatCsv({ columns: ["a"], rows: [[-1]] })).toBe(
      "\uFEFFa\r\n-1\r\n",
    );
  });
});
