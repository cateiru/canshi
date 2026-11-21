import { render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { vi } from "vitest";
import { App } from "../App";

type ApiHandler = (init: RequestInit | undefined) => {
  status: number;
  body: unknown;
};

/** API の応答。`"GET /users"` のようなキーごとに、JSON か、状態と JSON を返す関数を置く */
export type ApiRoutes = Record<string, object | ApiHandler>;

/** fetch を差し替え、`/api` 以下のパスを `routes` から返す。呼ばれた fetch を返す */
export function stubApi(routes: ApiRoutes) {
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), "http://localhost");
      const key = `${init?.method ?? "GET"} ${url.pathname.replace(/^\/api/, "")}`;
      const route = key in routes ? routes[key] : undefined;
      if (route === undefined) {
        return new Response(JSON.stringify({ error: "見つかりません" }), {
          status: 404,
        });
      }
      const { status, body } =
        typeof route === "function"
          ? route(init)
          : { status: 200, body: route };
      return new Response(JSON.stringify(body), { status });
    },
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function LocationProbe() {
  const location = useLocation();
  return (
    <div
      data-testid="location"
      hidden
    >{`${location.pathname}${location.search}`}</div>
  );
}

/** `path` を開いた管理画面を描き、読み込みが終わるまで待つ */
export async function renderApp(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
      <LocationProbe />
    </MemoryRouter>,
  );
  await waitForLoaded();
}

export async function waitForLoaded() {
  await vi.waitFor(() => {
    if (document.querySelector('[aria-busy="true"]')) {
      throw new Error("読み込み中");
    }
  });
}

/** 今の URL（パスとクエリ） */
export function currentLocation() {
  return screen.getByTestId("location").textContent;
}
