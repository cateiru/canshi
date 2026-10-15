// メインアプリと同じ Tabler Icons（`react-icons/tb`）の線画アイコン。管理画面は react を
// 使わないため、必要なものだけ SVG のパスを写して使う。装飾として aria-hidden を付ける

function TablerIcon(props: { paths: string[] }) {
  return (
    <svg
      class="icon"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      {props.paths.map((d) => (
        <path d={d} />
      ))}
    </svg>
  );
}

/** TbPlus */
export function PlusIcon() {
  return <TablerIcon paths={["M12 5l0 14", "M5 12l14 0"]} />;
}

/** TbPencil */
export function PencilIcon() {
  return (
    <TablerIcon
      paths={[
        "M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4",
        "M13.5 6.5l4 4",
      ]}
    />
  );
}

/** TbTrash */
export function TrashIcon() {
  return (
    <TablerIcon
      paths={[
        "M4 7l16 0",
        "M10 11l0 6",
        "M14 11l0 6",
        "M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12",
        "M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3",
      ]}
    />
  );
}

/** TbPhotoPlus */
export function PhotoPlusIcon() {
  return (
    <TablerIcon
      paths={[
        "M15 8h.01",
        "M12.5 21h-6.5a3 3 0 0 1 -3 -3v-12a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v6.5",
        "M3 16l5 -5c.928 -.893 2.072 -.893 3 0l4 4",
        "M14 14l1 -1c.67 -.644 1.45 -.824 2.182 -.54",
        "M16 19h6",
        "M19 16v6",
      ]}
    />
  );
}

/** TbPhoto（画像のない商品の代わりに表示する） */
export function PhotoIcon() {
  return (
    <TablerIcon
      paths={[
        "M15 8h.01",
        "M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-12z",
        "M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5",
        "M14 14l1 -1c.928 -.893 2.072 -.893 3 0l3 3",
      ]}
    />
  );
}
