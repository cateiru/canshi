import { watchScrollbarWidth } from "@canshi/shared/styles/scrollbarWidth";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { App } from "./App";
import "./global.css";

// 画面は描画の前に作るため、ここで測れば最初の描画に間に合う（global.css の #root）
watchScrollbarWidth();

const root = document.getElementById("root");
if (!root) {
  throw new Error("#root がありません");
}

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
