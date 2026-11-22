// vinext（1.4.6）は `import { ViewTransition } from "react"` を含むファイルの `react` からの import を
// すべて独自のモジュール（`virtual:vinext-react-canary`）に向け替える。そのモジュールは
// `export * from "react"` で残りを再エクスポートするが、CommonJS の `react` では再エクスポートが
// 効かず、同じファイルの `useEffect`・`useTransition` などが取れなくなる（開発サーバー・SSR）。
// 向け替えの対象（`import { ... } from "react"`）にならないよう、export 文で再エクスポートする。
// react@19.3.1 は `ViewTransition` を持つため、vinext の代わりの実装は使わない
export { ViewTransition } from "react";
