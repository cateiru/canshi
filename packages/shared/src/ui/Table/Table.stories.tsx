import type { Meta, StoryObj } from "@storybook/react-vite";
import { TbTrash } from "react-icons/tb";
import { Badge } from "../Badge/Badge";
import { IconButton } from "../Button/IconButton";
import { Table, TableActionCell, TableActionHeader } from "./Table";

const meta = {
  title: "表示/Table",
  component: Table,
} satisfies Meta<typeof Table>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Table {...args}>
      <thead>
        <tr>
          <th scope="col">名前</th>
          <th scope="col">参加した日</th>
          <TableActionHeader />
        </tr>
      </thead>
      <tbody>
        <tr>
          <th scope="row">
            ねこ好き <Badge color="accent">オーナー</Badge>
          </th>
          <td>2026年10月1日</td>
          <TableActionCell />
        </tr>
        <tr>
          <th scope="row">家族</th>
          <td>2026年10月7日</td>
          <TableActionCell>
            <IconButton icon={TbTrash} aria-label="家族を外す" />
          </TableActionCell>
        </tr>
      </tbody>
    </Table>
  ),
};
