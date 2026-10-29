import { describe, expect, it } from "vitest";
import {
  decideRlsRole,
  type RlsEnforcementMode,
  type RuntimeRoleCheck,
} from "../db/rlsRoleGuard.js";

const applies: RuntimeRoleCheck = {
  role: "mms_app",
  isSuperuser: false,
  bypassRls: false,
  rlsApplies: true,
};
const superuser: RuntimeRoleCheck = {
  role: "postgres",
  isSuperuser: true,
  bypassRls: true,
  rlsApplies: false,
};

describe("decideRlsRole", () => {
  it("allows a role that is subject to RLS in every mode", () => {
    for (const mode of ["strict", "warn", "off"] as RlsEnforcementMode[]) {
      expect(decideRlsRole(applies, mode)).toMatchObject({ allow: true });
    }
  });

  it("refuses a bypassing role in strict mode", () => {
    const decision = decideRlsRole(superuser, "strict");
    expect(decision.allow).toBe(false);
    expect(decision.level).toBe("error");
    if (!decision.allow) expect(decision.message).toContain("CREATE ROLE mms_app");
  });

  it("allows but warns for a bypassing role in warn mode", () => {
    const decision = decideRlsRole(superuser, "warn");
    expect(decision).toMatchObject({ allow: true, level: "warn" });
  });

  it("allows and stays silent in off mode", () => {
    expect(decideRlsRole(superuser, "off")).toEqual({ allow: true, level: "off" });
  });
});
