import { describe, expect, it, vi } from "vitest";
import { normalizeFaultLifecycle } from "../src/modules/faults/fault-lifecycle.js";
import { recalculateFaultStatuses } from "../src/modules/site-visits/fault-site-visits.repository.js";

const faultId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const resolvedAt = "2026-08-30T10:00:00.000Z";

function recalculationClient(latestRows) {
  const query = vi.fn()
    .mockResolvedValueOnce({ rows: [{ status: "resolved", resolved_at: resolvedAt }] })
    .mockResolvedValueOnce({ rows: latestRows })
    .mockResolvedValueOnce({ rows: [] });
  return { query };
}

describe("Fault/Site Visit lifecycle recalculation", () => {
  it("recalculates from the next latest remaining linked visit", async () => {
    const client = recalculationClient([{ status_after_visit: "monitoring", progress_update: "Observe" }]);
    await recalculateFaultStatuses(client, [faultId], userId);
    expect(client.query.mock.calls[2][1]).toEqual([faultId, "monitoring", null, userId, "Observe"]);
    expect(client.query.mock.calls[1][0]).toContain("ORDER BY sv.visit_date DESC,sv.created_at DESC,fsv.created_at DESC");
  });

  it("sets a Fault to Open and clears resolved_at when no links remain", async () => {
    const client = recalculationClient([]);
    await recalculateFaultStatuses(client, [faultId], userId);
    expect(client.query.mock.calls[2][1]).toEqual([faultId, "open", null, userId, null]);
  });
});

describe("Fault lifecycle normalization", () => {
  it.each(["open", "in_progress", "monitoring"])("clears resolved_at for Resolved → %s", (status) => {
    expect(normalizeFaultLifecycle("resolved", status)).toEqual({ status, resolved_at: null });
  });

  it("sets resolved_at when transitioning into Resolved", () => {
    expect(normalizeFaultLifecycle("monitoring", "resolved", () => resolvedAt)).toEqual({ status: "resolved", resolved_at: resolvedAt });
  });
});
