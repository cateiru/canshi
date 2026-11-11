"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia?.(QUERY);
  query?.addEventListener("change", onChange);
  return () => query?.removeEventListener("change", onChange);
}

function getSnapshot(): boolean {
  return window.matchMedia?.(QUERY).matches ?? false;
}

function getServerSnapshot(): boolean {
  return false;
}

/** 端末で「視差効果を減らす」（prefers-reduced-motion: reduce）が有効かどうか */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
