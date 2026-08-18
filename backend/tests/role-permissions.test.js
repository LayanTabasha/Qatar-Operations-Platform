import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ROLE_GROUPS } from "../src/modules/auth/permissions.js";

describe("authoritative role permission groups", () => {
  it("matches the four-role capability matrix", () => {
    expect(ROLE_GROUPS.requestRead).toEqual(["admin", "hq_user"]);
    expect(ROLE_GROUPS.requestProcess).toEqual(["hq_user"]);
    expect(ROLE_GROUPS.operationalManage).toEqual(["admin", "hq_user", "operations_staff"]);
    expect(ROLE_GROUPS.adminOnly).toEqual(["admin"]);
    expect(ROLE_GROUPS.authenticatedRead).toEqual(["admin", "hq_user", "operations_staff", "viewer"]);
  });

  it("uses separate frontend checks for Requests, infrastructure, and operational records", () => {
    const state = fs.readFileSync(path.resolve("../js/state.js"), "utf8");
    const requests = fs.readFileSync(path.resolve("../js/requests-page.js"), "utf8");
    expect(state).toContain('["admin", "hq_user"].includes');
    expect(state).toContain('["admin", "hq_user", "operations_staff"].includes');
    expect(state).toContain("function isAdmin()");
    expect(requests).toContain('=== "hq_user"');
  });
});
