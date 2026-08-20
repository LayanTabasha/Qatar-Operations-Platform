async function restoreArchivedCharger(chargerId) {
  try {
    await window.QatarOpsApi.Chargers.restore(chargerId);
    await loadOperationalData();
    if (state.currentSiteName) openSite(state.currentSiteName, "Chargers");
  } catch (err) {
    alert(err.message || "The charger could not be restored.");
  }
}

async function permanentlyDeleteArchivedCharger(chargerId, chargerName, chargerCode) {
  if (!isAdmin()) {
    alert("Only Administrator accounts can permanently delete archived chargers.");
    return;
  }
  const confirmation = window.prompt(`Permanently delete this charger? This action cannot be undone.\n\nType ${chargerCode || chargerName} to confirm.`);
  if (confirmation !== (chargerCode || chargerName)) return;
  try {
    await window.QatarOpsApi.Chargers.deleteArchived(chargerId);
    await loadOperationalData();
    if (state.currentSiteName) openSite(state.currentSiteName, "Chargers");
  } catch (err) {
    alert(err.message || "The archived charger could not be permanently deleted.");
  }
}

