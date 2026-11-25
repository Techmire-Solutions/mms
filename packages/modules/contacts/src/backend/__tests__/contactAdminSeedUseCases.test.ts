import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Contact } from "@mms/contracts";

const mocks = vi.hoisted(() => ({
  prepareContactRecord: vi.fn(),
  saveContact: vi.fn(),
  auditContactPersisted: vi.fn(),
}));

vi.mock("../use-cases/contactValidationUseCases.js", () => ({
  prepareContactRecord: mocks.prepareContactRecord,
}));

vi.mock("../repository/contactsRepositoryAdapter.js", () => ({
  contactsRepository: { save: mocks.saveContact },
}));

vi.mock("../use-cases/contactWriteAudit.js", () => ({
  auditContactPersisted: mocks.auditContactPersisted,
}));

import { createAdminFirstContact } from "../use-cases/index.js";

describe("createAdminFirstContact", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prepareContactRecord.mockImplementation(async (contact: Contact) => contact);
    mocks.saveContact.mockResolvedValue("2026-01-01T00:00:00.000Z");
    mocks.auditContactPersisted.mockResolvedValue(undefined);
  });

  it("builds a normalized first contact from the admin's full name, email and phone", async () => {
    const id = await createAdminFirstContact({
      subdomain: "demo",
      name: "Ali Raza Admin",
      email: "Admin@Demo.COM",
      phone: "+92 300 1234567",
      gender: "female",
    });

    expect(mocks.prepareContactRecord).toHaveBeenCalledTimes(1);
    const prepared = mocks.prepareContactRecord.mock.calls[0]![0] as Contact;
    expect(prepared.firstName).toBe("Ali");
    expect(prepared.lastName).toBe("Raza Admin");
    expect(prepared.name).toBe("Ali Raza Admin");
    expect(prepared.emails).toEqual([
      { label: "Primary", address: "admin@demo.com", isPrimary: true },
    ]);
    // Scalar phone is handed to `prepareContactRecord`, which expands it into a
    // normalized `phones` row using the tenant's default label/dial code.
    expect(prepared.phone).toBe("+92 300 1234567");
    expect(prepared.phones).toBeUndefined();
    expect(prepared.gender).toBe("female");
    expect(prepared.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(prepared.id).not.toMatch(/^temp-/);

    expect(mocks.saveContact).toHaveBeenCalledWith("demo", prepared);
    expect(mocks.auditContactPersisted).toHaveBeenCalledWith({
      tenant: "demo",
      contactId: prepared.id,
      actorId: undefined,
      created: true,
      restored: false,
    });
    expect(id).toBe(prepared.id);
  });

  it("handles a single-word admin name and omits phone records when none is provided", async () => {
    const id = await createAdminFirstContact({
      subdomain: "demo",
      name: "Ayesha",
      email: "ayesha@demo.com",
    });

    const prepared = mocks.prepareContactRecord.mock.calls[0]![0] as Contact;
    expect(prepared.firstName).toBe("Ayesha");
    expect(prepared.lastName).toBeUndefined();
    expect(prepared.phone).toBeUndefined();
    expect(prepared.gender).toBeUndefined();
    expect(id).toBe(prepared.id);
  });
});
