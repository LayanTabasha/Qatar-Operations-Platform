import { pool, query } from "../../config/database.js";

const sortableColumns = {
  dtc_code: "dtc_code_normalized",
  fault_title: "fault_title",
  category: "category",
  charger_model: "charger_model",
  updated_at: "updated_at",
};

const dtcSelect = `
  SELECT
    id,
    dtc_code,
    dtc_code_normalized,
    ftb_code,
    fault_title,
    description,
    possible_causes,
    recommended_actions,
    severity,
    category,
    charger_model,
    component,
    source_version,
    source_sheet,
    source_row,
    manufacturer_data,
    is_active,
    imported_at,
    imported_by,
    created_at,
    updated_at
  FROM fault_catalogue
`;

export function normalizeDtcCode(code) {
  return String(code || "").trim().toUpperCase().replace(/\s+/g, "");
}

export async function listDtcRecords(options = {}) {
  const {
    code,
    query: keyword,
    charger_model,
    category,
    severity,
    status = "active",
    sort = "dtc_code",
    order = "asc",
    limit = 50,
    offset = 0,
  } = options;
  const values = [];
  const filters = [];

  if (status === "active") filters.push("is_active = true");
  if (status === "inactive") filters.push("is_active = false");

  if (code) {
    values.push(`%${normalizeDtcCode(code)}%`);
    filters.push(`dtc_code_normalized ILIKE $${values.length}`);
  }

  if (keyword) {
    values.push(`%${keyword}%`);
    filters.push(`(
      dtc_code ILIKE $${values.length}
      OR fault_title ILIKE $${values.length}
      OR description ILIKE $${values.length}
      OR possible_causes ILIKE $${values.length}
      OR recommended_actions ILIKE $${values.length}
    )`);
  }

  if (charger_model) {
    values.push(charger_model);
    filters.push(`charger_model = $${values.length}`);
  }

  if (category) {
    values.push(category);
    filters.push(`category = $${values.length}`);
  }

  if (severity) {
    values.push(severity);
    filters.push(`severity = $${values.length}`);
  }

  const sortColumn = sortableColumns[sort] || sortableColumns.dtc_code;
  const sortOrder = order === "desc" ? "DESC" : "ASC";
  values.push(limit);
  const limitPlaceholder = `$${values.length}`;
  values.push(offset);
  const offsetPlaceholder = `$${values.length}`;

  const result = await query(
    `
      ${dtcSelect}
      ${filters.length ? `WHERE ${filters.join(" AND ")}` : ""}
      ORDER BY ${sortColumn} ${sortOrder}, ftb_code ASC NULLS FIRST
      LIMIT ${limitPlaceholder}
      OFFSET ${offsetPlaceholder}
    `,
    values,
  );

  return result.rows;
}

export async function findDtcById(id) {
  const result = await query(`${dtcSelect} WHERE id = $1`, [id]);
  return result.rows[0] || null;
}

export async function upsertDtcRecord(record, client = pool) {
  const normalizedCode = normalizeDtcCode(record.dtc_code);
  const result = await client.query(
    `
      INSERT INTO fault_catalogue (
        dtc_code,
        dtc_code_normalized,
        ftb_code,
        fault_title,
        description,
        possible_causes,
        recommended_actions,
        severity,
        category,
        charger_model,
        component,
        source_version,
        source_sheet,
        source_row,
        manufacturer_data,
        is_active,
        imported_at,
        imported_by
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, COALESCE($16, true), $17, $18
      )
      ON CONFLICT (dtc_code_normalized, ftb_code, charger_model, component)
      DO UPDATE SET
        dtc_code = EXCLUDED.dtc_code,
        fault_title = EXCLUDED.fault_title,
        description = EXCLUDED.description,
        possible_causes = EXCLUDED.possible_causes,
        recommended_actions = EXCLUDED.recommended_actions,
        severity = EXCLUDED.severity,
        category = EXCLUDED.category,
        source_version = EXCLUDED.source_version,
        source_sheet = EXCLUDED.source_sheet,
        source_row = EXCLUDED.source_row,
        manufacturer_data = EXCLUDED.manufacturer_data,
        is_active = EXCLUDED.is_active,
        imported_at = EXCLUDED.imported_at,
        imported_by = EXCLUDED.imported_by
      RETURNING *, (xmax = 0) AS inserted
    `,
    [
      record.dtc_code,
      normalizedCode,
      record.ftb_code ?? "",
      record.fault_title,
      record.description ?? null,
      record.possible_causes ?? null,
      record.recommended_actions ?? null,
      record.severity ?? null,
      record.category ?? null,
      record.charger_model ?? "",
      record.component ?? "",
      record.source_version ?? null,
      record.source_sheet ?? null,
      record.source_row ?? null,
      JSON.stringify(record.manufacturer_data || {}),
      record.is_active !== false,
      record.imported_at ?? null,
      record.imported_by ?? null,
    ],
  );

  return result.rows[0];
}

export async function updateDtcById(id, input) {
  const fields = [];
  const values = [];

  Object.entries(input).forEach(([key, value]) => {
    if (key === "dtc_code") {
      values.push(value);
      fields.push(`dtc_code = $${values.length}`);
      values.push(normalizeDtcCode(value));
      fields.push(`dtc_code_normalized = $${values.length}`);
      return;
    }

    if (key === "manufacturer_data") {
      values.push(JSON.stringify(value || {}));
      fields.push(`manufacturer_data = $${values.length}`);
      return;
    }

    if (["ftb_code", "charger_model", "component"].includes(key)) {
      values.push(value ?? "");
      fields.push(`${key} = $${values.length}`);
      return;
    }

    values.push(value);
    fields.push(`${key} = $${values.length}`);
  });

  values.push(id);
  const result = await query(
    `
      UPDATE fault_catalogue
      SET ${fields.join(", ")}
      WHERE id = $${values.length}
      RETURNING *
    `,
    values,
  );

  return result.rows[0] || null;
}

export async function updateDtcStatusById(id, isActive) {
  const result = await query(
    `
      UPDATE fault_catalogue
      SET is_active = $2
      WHERE id = $1
      RETURNING *
    `,
    [id, isActive],
  );

  return result.rows[0] || null;
}

export async function importDtcRecords(records, userId) {
  const client = await pool.connect();
  const summary = {
    new_records: 0,
    updated_records: 0,
    skipped_records: 0,
    invalid_records: 0,
  };

  try {
    await client.query("BEGIN");
    const importedAt = new Date().toISOString();

    for (const record of records) {
      const row = await upsertDtcRecord(
        {
          ...record,
          imported_at: importedAt,
          imported_by: userId,
        },
        client,
      );

      if (row.inserted) summary.new_records += 1;
      else summary.updated_records += 1;
    }

    await client.query("COMMIT");
    return summary;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
