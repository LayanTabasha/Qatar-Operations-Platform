import { query } from "../../config/database.js";

const select = `SELECT contacts.*, sites.name AS site_name FROM contacts LEFT JOIN sites ON sites.id = contacts.site_id`;

export async function listContacts(options) {
  const values = [], filters = ["contacts.active = true"];
  if (options.site_id) { values.push(options.site_id); filters.push(`contacts.site_id = $${values.length}`); }
  if (options.search) {
    values.push(`%${options.search}%`);
    filters.push(`(contacts.contact_name ILIKE $${values.length} OR contacts.organization ILIKE $${values.length} OR contacts.job_title ILIKE $${values.length} OR contacts.email ILIKE $${values.length} OR contacts.phone ILIKE $${values.length} OR contacts.contact_type ILIKE $${values.length} OR contacts.notes ILIKE $${values.length} OR sites.name ILIKE $${values.length})`);
  }
  values.push(options.limit || 100);
  return (await query(`${select} WHERE ${filters.join(" AND ")} ORDER BY contacts.contact_name ASC LIMIT $${values.length}`, values)).rows;
}

export async function findContactById(id) { return (await query(`${select} WHERE contacts.id=$1 AND contacts.active=true LIMIT 1`, [id])).rows[0] || null; }
export async function insertContact(input, actor) {
  const columns = [...Object.keys(input), "created_by"], values = [...Object.values(input), actor];
  const created = (await query(`INSERT INTO contacts (${columns.join(",")}) VALUES (${values.map((_, i) => `$${i + 1}`).join(",")}) RETURNING id`, values)).rows[0];
  return findContactById(created.id);
}
export async function updateContactById(id, updates) {
  const entries = Object.entries(updates), values = [id, ...entries.map(([, value]) => value ?? null)];
  const changed = (await query(`UPDATE contacts SET ${entries.map(([key], i) => `${key}=$${i + 2}`).join(",")}, updated_at=now() WHERE id=$1 AND active=true RETURNING id`, values)).rows[0];
  return changed ? findContactById(id) : null;
}
export async function deactivateContactById(id) { return (await query("UPDATE contacts SET active=false, updated_at=now() WHERE id=$1 AND active=true RETURNING id", [id])).rows[0] || null; }
