import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        // サーバー（API・DB）。D1 は sql.js で包んだもの（src/test/d1.ts）を使う
        test: {
          name: "worker",
          environment: "node",
          include: ["src/**/*.test.ts"],
          exclude: ["src/client/**"],
        },
      },
      {
        // 画面（React）。jsdom で描画し、API は fetch を差し替えて返す
        plugins: [react()],
        test: {
          name: "client",
          environment: "jsdom",
          include: ["src/client/**/*.test.{ts,tsx}"],
          setupFiles: ["./src/client/test/setup.ts"],
        },
      },
    ],
  },
});
