"use client";

import { useActionState } from "react";
import type { SubmitRedirect } from "./types";
import { useNavigateAfterSubmit } from "./useNavigateAfterSubmit";

/**
 * `useActionState` をラップし、Action が `redirectTo` を返したらその画面へ遷移する。
 * 遷移が終わるまでは送信中として扱い、二重送信を防ぐ
 */
export function useSubmitActionState<S extends SubmitRedirect>(
  action: (state: S, formData: FormData) => Promise<S>,
  initialState: S,
) {
  const navigate = useNavigateAfterSubmit();
  const [state, formAction, isPending] = useActionState<S, FormData>(
    async (previousState, formData) => {
      const result = await action(previousState as S, formData);
      if (result.redirectTo) {
        navigate(result.redirectTo);
      }
      return result;
      // S は Promise ではない状態オブジェクトなので Awaited<S> と同じ型として扱う
    },
    initialState as Awaited<S>,
  );
  return [
    state,
    formAction,
    isPending || state.redirectTo !== undefined,
  ] as const;
}
