import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath) => fs.readFileSync(path.resolve(relativePath), "utf8");
const faults = read("src/modules/faults/faults.repository.js");
const visits = read("src/modules/site-visits/site-visits.repository.js");
const requests = read("src/modules/requests/requests.repository.js");
const attachments = read("src/modules/attachments/attachments.repository.js");
const migration = read("src/db/migrations/034_allow_fault_site_visit_creator_nullification.sql");

describe("historical user-reference preservation", () => {
  it("keeps Faults visible and labels a missing creator", () => {
    expect(faults).toContain("LEFT JOIN users creator ON creator.id=faults.created_by");
    expect(faults).toContain("COALESCE(creator.full_name, 'Deleted user') AS created_by_name");
  });

  it("keeps Site Visits and their attachments visible when historical users are missing", () => {
    expect(visits).toContain("LEFT JOIN users created_by_user ON created_by_user.id = site_visits.created_by");
    expect(visits).toContain("COALESCE(created_by_user.full_name, 'Deleted user') AS recorded_by_name");
    expect(visits).toContain("LEFT JOIN users attachment_user ON attachment_user.id = a.uploaded_by");
    expect(visits).toContain("COALESCE(attachment_user.full_name, 'Deleted user')");
  });

  it("keeps Requests visible when the nullable requester is missing", () => {
    expect(requests).toContain("LEFT JOIN users requester ON requester.id=requests.requested_by");
    expect(requests).toContain("COALESCE(requester.full_name, 'Deleted user') AS requested_by_name");
  });

  it("keeps attachments listable and attributable when the uploader is missing", () => {
    expect(attachments).toContain("LEFT JOIN users ON users.id = operational_attachments.uploaded_by");
    expect(attachments).toContain("COALESCE(users.full_name, 'Deleted user') AS uploaded_by_name");
    expect(requests).toContain("LEFT JOIN users uploader ON uploader.id = a.uploaded_by");
  });

  it("preserves normal names while applying the fallback only to null names", () => {
    expect("COALESCE(existing_user.full_name, 'Deleted user')").toContain("existing_user.full_name");
    for (const source of [faults, visits, requests, attachments]) expect(source).toContain("'Deleted user'");
  });

  it("makes relationship creators nullable with ON DELETE SET NULL", () => {
    expect(migration).toContain("ALTER COLUMN created_by DROP NOT NULL");
    expect(migration).toContain("DROP CONSTRAINT IF EXISTS fault_site_visits_created_by_fkey");
    expect(migration).toMatch(/FOREIGN KEY \(created_by\) REFERENCES users\(id\) ON DELETE SET NULL/);
    expect(migration).not.toMatch(/DELETE FROM|UPDATE fault_site_visits|ON DELETE CASCADE/);
  });
});
