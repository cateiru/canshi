import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Table, TableActionCell } from "./Table";

describe("Table", () => {
  it("aria-labelledby などの属性を table 要素に渡す", () => {
    render(
      <>
        <h2 id="title">一覧</h2>
        <Table aria-labelledby="title">
          <tbody>
            <tr>
              <td>内容</td>
            </tr>
          </tbody>
        </Table>
      </>,
    );
    expect(screen.getByRole("table", { name: "一覧" })).toBeInTheDocument();
  });
});

describe("TableActionCell", () => {
  it("操作がない行でも、高さを確保する要素をセルの中に置く", () => {
    render(
      <table>
        <tbody>
          <tr>
            <TableActionCell>{null}</TableActionCell>
          </tr>
        </tbody>
      </table>,
    );
    const cell = screen.getByRole("cell");
    expect(cell.className).toMatch(/actionCell/);
    expect(cell.firstElementChild?.className).toMatch(/actions/);
  });

  it("children をセルの中に表示する", () => {
    render(
      <table>
        <tbody>
          <tr>
            <TableActionCell>
              <button type="button">ログアウト</button>
            </TableActionCell>
          </tr>
        </tbody>
      </table>,
    );
    expect(screen.getByRole("cell").querySelector("button")).toHaveTextContent(
      "ログアウト",
    );
  });
});
