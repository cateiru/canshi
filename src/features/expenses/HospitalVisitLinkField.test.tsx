import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { LinkableHospitalVisit } from "@/features/hospital-visits/queries";

const listLinkableHospitalVisitsAction = vi.fn();
vi.mock("./actions", () => ({ listLinkableHospitalVisitsAction }));

const { useLinkableHospitalVisits } = await import("./HospitalVisitLinkField");

const visit = { id: "visit-1" } as LinkableHospitalVisit;

describe("useLinkableHospitalVisits", () => {
  it("取得に失敗したら候補なしと区別し、読み込み直せる", async () => {
    listLinkableHospitalVisitsAction.mockRejectedValueOnce(
      new Error("offline"),
    );
    listLinkableHospitalVisitsAction.mockResolvedValueOnce([visit]);
    const { result } = renderHook(() =>
      useLinkableHospitalVisits("tama", "2026-09-15", true, "expense-1"),
    );
    expect(result.current.status).toBe("loading");

    await waitFor(() => expect(result.current.status).toBe("error"));
    const state = result.current;
    if (state.status !== "error") throw new Error("unreachable");
    act(() => state.retry());

    await waitFor(() =>
      expect(result.current).toEqual({ status: "loaded", visits: [visit] }),
    );
    expect(listLinkableHospitalVisitsAction).toHaveBeenCalledTimes(2);
  });
});
