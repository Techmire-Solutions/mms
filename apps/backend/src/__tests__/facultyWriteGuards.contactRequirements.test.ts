import { describe, expect, it, vi } from "vitest";

vi.mock("../db/tenant-context.js", () => ({
  withTenantRead: vi.fn(),
}));

import { validateFacultyContactLink } from "../faculty/use-cases/facultyWriteGuards.js";
import { withTenantRead } from "../db/tenant-context.js";

const mockedWithTenantRead = vi.mocked(withTenantRead);

/**
 * Installs a fake transaction whose `execute` drains a FIFO of row responses in
 * the guard's deterministic call order. Any extra query returns no rows.
 */
function install(responses: Array<{ rows: unknown[] }>): void {
  const queue = [...responses];
  const tx = {
    execute: async (): Promise<{ rows: unknown[] }> => {
      return queue.shift() ?? { rows: [] };
    },
  };
  mockedWithTenantRead.mockImplementation(async (_tenant, callback) => callback(tx as never));
}

describe("validateFacultyContactLink — contact eligibility requirements", () => {
  it("rejects an email-less contact when requireEmail is on", async () => {
    install([{ rows: [{ id: "c1" }] }, { rows: [] }]);
    await expect(
      validateFacultyContactLink("demo", "c1", undefined, {
        requireEmail: true,
        requirePhone: false,
      }),
    ).rejects.toThrow("The linked contact must have an email address");
  });

  it("accepts an email-less contact when requireEmail is off", async () => {
    install([{ rows: [{ id: "c1" }] }, { rows: [] }]);
    await expect(
      validateFacultyContactLink("demo", "c1", undefined, {
        requireEmail: false,
        requirePhone: false,
      }),
    ).resolves.toEqual({ userId: null });
  });

  it("rejects a phone-less contact when requirePhone is on", async () => {
    install([{ rows: [{ id: "c1" }] }, { rows: [{ address: "a@b.c" }] }, { rows: [] }]);
    await expect(
      validateFacultyContactLink("demo", "c1", undefined, {
        requireEmail: true,
        requirePhone: true,
      }),
    ).rejects.toThrow("The linked contact must have a phone number");
  });

  it("accepts a phone-less contact when requirePhone is off", async () => {
    install([
      { rows: [{ id: "c1" }] },
      { rows: [{ address: "a@b.c" }] },
      { rows: [] }, // duplicate-email probe
      { rows: [] }, // tenant_users probe
    ]);
    await expect(
      validateFacultyContactLink("demo", "c1", undefined, {
        requireEmail: true,
        requirePhone: false,
      }),
    ).resolves.toEqual({ userId: null });
  });
});
