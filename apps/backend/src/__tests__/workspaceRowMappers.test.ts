import { describe, expect, it } from "vitest";
import { rowToProvisionedAdmin } from "../db/repositories/workspaceRowMappers.js";

describe("rowToProvisionedAdmin", () => {
  it("returns null when the workspace has no provisioning snapshot (legacy rows)", () => {
    expect(rowToProvisionedAdmin({})).toBeNull();
    expect(
      rowToProvisionedAdmin({ adminName: null, adminEmail: null, adminGender: null }),
    ).toBeNull();
    expect(rowToProvisionedAdmin({ adminName: "  ", adminEmail: " ", adminGender: "" })).toBeNull();
  });

  it("maps and trims the stored admin identity", () => {
    expect(
      rowToProvisionedAdmin({
        adminName: "  Ali Raza  ",
        adminEmail: " admin@alnoor.test ",
        adminGender: "male",
      }),
    ).toEqual({ name: "Ali Raza", email: "admin@alnoor.test", gender: "male" });
  });

  it("keeps partial records (e.g. only the email) without inventing fields", () => {
    expect(rowToProvisionedAdmin({ adminEmail: "admin@alnoor.test" })).toEqual({
      email: "admin@alnoor.test",
    });
  });
});
