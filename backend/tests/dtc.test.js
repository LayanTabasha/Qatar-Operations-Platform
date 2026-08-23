import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const authRepositoryMocks = vi.hoisted(() => ({
  findSafeUserById: vi.fn(),
}));

const dtcServiceMocks = vi.hoisted(() => ({
  createDtcRecord: vi.fn(),
  getDtcRecord: vi.fn(),
  getDtcRecords: vi.fn(),
  importDtcWorkbook: vi.fn(),
  updateDtcRecord: vi.fn(),
  updateDtcRecordStatus: vi.fn(),
}));

vi.mock("../src/modules/auth/auth.repository.js", () => ({
  findUserWithPasswordByEmail: vi.fn(),
  findSafeUserById: authRepositoryMocks.findSafeUserById,
  updateLastLoginAt: vi.fn(),
}));

vi.mock("../src/modules/dtc/dtc.service.js", () => dtcServiceMocks);

let app;
let jwt;

const adminUser = {
  id: "11111111-1111-4111-8111-111111111111",
  full_name: "Admin User",
  email: "admin@example.com",
  role: "admin",
  is_active: true,
};
const operatorUser = { ...adminUser, role: "operations_staff" };
const viewerUser = { ...adminUser, role: "viewer" };
const dtcId = "55555555-5555-4555-8555-555555555555";
const dtcRecord = {
  id: dtcId,
  dtc_code: "P0301",
  ftb_code: "00",
  fault_title: "CCU_Over-current protection failure",
  description: "CCU_Over-current protection failure",
  possible_causes: "DC output current over calibrated threshold",
  recommended_actions: "Recover after pulling the gun",
  severity: "2012",
  category: "Yes",
  charger_model: "ZD",
  component: "CCU",
  source_version: "V1.4",
  source_sheet: "DTC",
  is_active: true,
};

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.PORT = "3000";
  process.env.DATABASE_URL = "postgresql://username:password@localhost:5432/qatar_operations";
  process.env.DATABASE_SSL = "false";
  process.env.FRONTEND_ORIGIN = "http://localhost:5500";
  process.env.LOG_LEVEL = "silent";
  process.env.TRUST_PROXY = "false";
  process.env.JWT_SECRET = "test-secret-value-that-is-long-enough-for-validation";
  process.env.JWT_EXPIRES_IN = "8h";
  process.env.AUTH_COOKIE_NAME = "qatar_ops_token";
  process.env.COOKIE_SECURE = "false";
  process.env.COOKIE_SAME_SITE = "lax";

  ({ app } = await import("../src/app.js"));
  jwt = await import("jsonwebtoken");
});

beforeEach(() => {
  vi.clearAllMocks();
  dtcServiceMocks.getDtcRecords.mockResolvedValue([dtcRecord]);
  dtcServiceMocks.getDtcRecord.mockResolvedValue(dtcRecord);
  dtcServiceMocks.createDtcRecord.mockResolvedValue(dtcRecord);
  dtcServiceMocks.updateDtcRecord.mockResolvedValue(dtcRecord);
  dtcServiceMocks.updateDtcRecordStatus.mockResolvedValue({ ...dtcRecord, is_active: false });
  dtcServiceMocks.importDtcWorkbook.mockResolvedValue({
    new_records: 1,
    updated_records: 0,
    skipped_records: 0,
    invalid_records: 0,
    workbook: { sheet_names: ["DTC"] },
  });
});

function authCookie(user) {
  const token = jwt.default.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "8h",
  });

  authRepositoryMocks.findSafeUserById.mockResolvedValue(user);
  return [`qatar_ops_token=${token}`];
}

describe("DTC catalogue routes", () => {
  it("requires authentication", async () => {
    await request(app).get("/api/v1/dtc").expect(401);
  });

  it("allows viewers to list DTC records", async () => {
    const response = await request(app).get("/api/v1/dtc?code=P0301&status=active").set("Cookie", authCookie(viewerUser)).expect(200);

    expect(response.body.dtc_records[0].dtc_code).toBe("P0301");
    expect(dtcServiceMocks.getDtcRecords).toHaveBeenCalledWith(expect.objectContaining({ code: "P0301", status: "active" }));
  });

  it("allows operations staff to view a DTC record", async () => {
    const response = await request(app).get(`/api/v1/dtc/${dtcId}`).set("Cookie", authCookie(operatorUser)).expect(200);

    expect(response.body.dtc_record.id).toBe(dtcId);
  });

  it("rejects non-admin DTC creation", async () => {
    await request(app)
      .post("/api/v1/dtc")
      .set("Cookie", authCookie(operatorUser))
      .send({ dtc_code: "P0301", fault_title: "Fault" })
      .expect(403);
  });

  it("allows admins to create DTC records", async () => {
    await request(app)
      .post("/api/v1/dtc")
      .set("Cookie", authCookie(adminUser))
      .send({ dtc_code: "P0301", fault_title: "Fault", description: "Description" })
      .expect(201);

    expect(dtcServiceMocks.createDtcRecord).toHaveBeenCalledWith(expect.objectContaining({ dtc_code: "P0301" }));
  });

  it("allows admins to update DTC status", async () => {
    await request(app)
      .patch(`/api/v1/dtc/${dtcId}/status`)
      .set("Cookie", authCookie(adminUser))
      .send({ is_active: false })
      .expect(200);

    expect(dtcServiceMocks.updateDtcRecordStatus).toHaveBeenCalledWith(dtcId, false);
  });

  it("rejects viewer imports", async () => {
    await request(app).post("/api/v1/dtc/import").set("Cookie", authCookie(viewerUser)).expect(403);
  });

  it("rejects missing import files", async () => {
    dtcServiceMocks.importDtcWorkbook.mockRejectedValueOnce(
      Object.assign(new Error("Choose a DTC Excel workbook before importing"), {
        statusCode: 400,
        code: "DTC_IMPORT_FILE_REQUIRED",
      }),
    );

    await request(app).post("/api/v1/dtc/import").set("Cookie", authCookie(adminUser)).expect(400);
  });

  it("rejects non-xlsx imports", async () => {
    await request(app)
      .post("/api/v1/dtc/import")
      .set("Cookie", authCookie(adminUser))
      .attach("file", Buffer.from("not excel"), "dtc.txt")
      .expect(400);
  });
});
