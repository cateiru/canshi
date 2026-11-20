import type { Meta, StoryObj } from "@storybook/react-vite";
import { CatFaceIcon } from "../RecordIcons/RecordIcons";
import { ImagePreview } from "./ImagePreview";

/** 外部の画像に頼らないよう、SVG で描いた見本の画像を使う */
const sampleImage = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600"><rect width="800" height="600" fill="#f5dfb7"/><circle cx="400" cy="300" r="160" fill="#ec995a"/><text x="400" y="560" font-size="40" text-anchor="middle" fill="#2e3142">sample</text></svg>',
)}`;

const meta = {
  title: "表示/ImagePreview",
  component: ImagePreview,
  args: {
    src: sampleImage,
    alt: "見本の画像",
    width: 120,
    height: 90,
    loading: "eager",
  },
  argTypes: {
    fit: { control: "inline-radio", options: ["contain", "actual"] },
    fallback: { control: false },
  },
} satisfies Meta<typeof ImagePreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** サムネイルを押すとモーダルで拡大表示する */
export const WithPreview: Story = {
  args: { previewSrc: sampleImage },
};

export const Fallback: Story = {
  args: {
    src: null,
    fallback: <CatFaceIcon size={64} />,
    fallbackLabel: "画像なし",
  },
};
