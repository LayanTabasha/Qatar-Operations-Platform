import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("../src/config/database.js", () => ({
  query: database.query,
  withTransaction: vi.fn(),
}));

const { operationalAttachmentParentIsActive, parentExists, parentTypes } = await import("../src/modules/attachments/attachments.repository.js");

const parentMappings = [
  ["documents", "documents", ""],
  ["weekly-reports", "reports", "report_type = 'weekly'"],
  ["troubleshooting", "troubleshooting_records", ""],
  ["site-visits", "site_visits", ""],
  ["faults", "faults", "archived_at IS NULL"],
  ["requests", "requests", "deleted_at IS NULL"],
];

describe("attachment parent existence", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(parentMappings)("allows an existing %s parent using the real table mapping", async (parentType, table, condition) => {
    database.query.mockResolvedValue({ rows: [{ id: "parent-1" }] });

    await expect(parentExists(parentType, "parent-1")).resolves.toBe(true);
    expect(database.query).toHaveBeenCalledWith(
      `SELECT id FROM ${table} WHERE id = $1${condition ? ` AND ${condition}` : ""}`,
      ["parent-1"],
    );
  });

  it.each(parentMappings)("rejects a missing %s parent", async (parentType) => {
    database.query.mockResolvedValue({ rows: [] });
    await expect(parentExists(parentType, "missing-parent")).resolves.toBe(false);
  });

  it("keeps every supported parent type mapped and validates attachment-ID operations", async () => {
    expect(parentTypes).toEqual(expect.objectContaining(Object.fromEntries(parentMappings.map(([type]) => [type, expect.objectContaining({ table: expect.any(String) })]))));
    database.query.mockResolvedValue({ rows: [] });
    await expect(operationalAttachmentParentIsActive({ parent_type: "documents", parent_record_id: "missing-parent" })).resolves.toBe(false);
  });

  it("checks the parent before upload middleware can write a file", () => {
    const routes = fs.readFileSync(path.resolve("src/modules/attachments/attachments.routes.js"), "utf8");
    const uploadRoute = routes.match(/attachmentsRouter\.post\([^;]+;/)?.[0] || "";
    expect(uploadRoute).toContain("requireAttachmentParent, operationalFileUpload, uploadAttachmentRecord");
  });
});
