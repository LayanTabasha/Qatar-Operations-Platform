import { query } from "../../config/database.js";

export async function chargerBelongsToSite(chargerId, siteId) {
  if (!chargerId) return true;
  if (!siteId) return false;
  const result = await query(
    `SELECT 1 FROM chargers JOIN sites ON sites.id=chargers.site_id
     WHERE chargers.id=$1 AND chargers.site_id=$2 AND chargers.status <> 'archived' AND sites.status <> 'archived'`,
    [chargerId, siteId],
  );
  return Boolean(result.rows[0]);
}
