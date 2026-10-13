import { describe, expect, it } from "vitest";
import { accountRecordSchema } from "../finance/accountingModuleManifest.js";

describe("accountRecordSchema", () => {
  const validAccount = {
    id: "account-1",
    code: "1000",
    name: "Cash",
    type: "Asset",
    subtype: "",
    description: "",
    isActive: true,
  } as const;

  it("accepts and trims a valid account", () => {
    expect(
      accountRecordSchema.parse({
        ...validAccount,
        code: " 1000 ",
        name: " Cash ",
      }),
    ).toMatchObject({ code: "1000", name: "Cash" });
  });

  it("rejects blank account codes and names", () => {
    const result = accountRecordSchema.safeParse({
      ...validAccount,
      code: " ",
      name: "",
    });

    expect(result.success).toBe(false);
  });

  it("accepts audit fields createdBy and updatedBy without strict violation", () => {
    const result = accountRecordSchema.safeParse({
      ...validAccount,
      createdBy: "user-123",
      updatedBy: "user-456",
    });

    expect(result.success).toBe(true);
  });
});
