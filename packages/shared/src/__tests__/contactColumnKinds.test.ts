import { describe, expect, it } from "vitest";
import { DEFAULT_COLUMN_REGISTRY } from "../contacts/contactTabRegistry.js";
import { getContactColumnKind } from "../contacts/contactColumnRegistry.js";
import { MODULE_COLUMN_KIND_WIDTHS } from "../settings/moduleColumnPreferences.js";

describe("contact column kinds", () => {
  it("given the default registry, should size kinded columns from the presets", () => {
    // Arrange
    const byKey = new Map(DEFAULT_COLUMN_REGISTRY.map((column) => [column.key, column]));

    // Act
    const phone = byKey.get("phone");
    const tag = byKey.get("tag");
    const email = byKey.get("email");

    // Assert
    expect(phone).toMatchObject({ kind: "phone", width: MODULE_COLUMN_KIND_WIDTHS.phone.width });
    expect(tag).toMatchObject({ kind: "chips", width: MODULE_COLUMN_KIND_WIDTHS.chips.width });
    expect(email).toMatchObject({ kind: "email", width: MODULE_COLUMN_KIND_WIDTHS.email.width });
  });

  it("given a stored overlay without kinds, should recover the kind by column key", () => {
    // Arrange
    const keys = ["name", "lunarDob", "custom:shoeSize"];

    // Act
    const kinds = keys.map(getContactColumnKind);

    // Assert
    expect(kinds).toEqual(["identity", "dualDate", undefined]);
  });
});
