export function normalizeFaultLifecycle(currentStatus, nextStatus, now = () => new Date().toISOString()) {
  const updates = { status: nextStatus };

  if (nextStatus === "resolved") {
    if (currentStatus !== "resolved") updates.resolved_at = now();
  } else {
    updates.resolved_at = null;
  }

  return updates;
}
