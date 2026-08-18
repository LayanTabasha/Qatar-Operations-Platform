import { describe, expect, it, vi } from "vitest";
import { legacyFaultPayload, planBrowserFaultImport, validateLegacyFaults } from "../src/scripts/import-browser-faults.js";
const record={ faultId:"FLT-2025-0001",siteName:"Mowasalat",chargerName:"Charger A",faultName:"Old browser fault",reportedAt:"2025-12-01T10:00:00.000Z",status:"Open",severity:"Not Classified" };
describe("reviewed browser fault recovery",()=>{
  it("reports invalid records without coercing them",()=>{ const result=validateLegacyFaults([record,{siteName:"Missing fields"}]); expect(result.valid).toHaveLength(1); expect(result.invalid).toHaveLength(1); });
  it("maps validated legacy fields without data URLs",()=>{ const payload=legacyFaultPayload(record,"site-id","charger-id","user-id"); expect(payload).toMatchObject({fault_reference:"FLT-2025-0001",status:"open",severity:"not_classified"}); expect(JSON.stringify(payload)).not.toContain("data:"); });
  it("maps a reviewed legacy Closed fault to the final Resolved state",()=>{ expect(legacyFaultPayload({...record,status:"Closed"},"site-id","charger-id","user-id").status).toBe("resolved"); });
  it("skips a duplicate reference and never issues an insert",async()=>{ const db={query:vi.fn().mockResolvedValueOnce({rows:[{site_id:"s",charger_id:"c"}]}).mockResolvedValueOnce({rows:[{id:"existing",fault_reference:record.faultId}]})}; const plan=await planBrowserFaultImport([record],db); expect(plan.ready).toHaveLength(0); expect(plan.skipped[0].reason).toContain("Duplicate"); expect(db.query).toHaveBeenCalledTimes(2); });
  it("prepares a unique record only after resolving its active site and charger",async()=>{ const db={query:vi.fn().mockResolvedValueOnce({rows:[{site_id:"s",charger_id:"c"}]}).mockResolvedValueOnce({rows:[]})}; const plan=await planBrowserFaultImport([record],db); expect(plan.ready[0].payload).toMatchObject({site_id:"s",charger_id:"c",title:"Old browser fault"}); });
});
