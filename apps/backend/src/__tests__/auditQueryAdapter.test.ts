import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ inTenantTransaction: false }));

const fakeRow = {
  id: 1,
  workspaceSubdomain: "demo",
  tableName: "students",
  recordId: "s-1",
  actionType: "UPDATE",
  realUserId: "u-1",
  impersonatedUserId: null,
  ipAddress: null,
  clientApp: null,
  sessionId: null,
  correlationId: null,
  apiEndpoint: null,
  httpMethod: null,
  oldState: "enc:subject:s-1:aa:bb:cc",
  newState: null,
  hashPrevious: "0".repeat(64),
  hashCurrent: "a".repeat(64),
  verificationStatus: "PENDING",
  transactionTimestamp: new Date("2026-10-29T12:00:00.000Z"),
};

const fakeDb = {
  select: () => ({
    from: () => ({
      where: () => ({
        orderBy: () => ({
          limit: async () => [fakeRow],
        }),
      }),
    }),
  }),
};

vi.mock("../db/tenant-context.js", () => ({
  withTenantRead: async (_tenant: string, cb: (db: unknown) => Promise<unknown>) => {
    state.inTenantTransaction = true;
    try {
      return await cb(fakeDb);
    } finally {
      state.inTenantTransaction = false;
    }
  },
}));

vi.mock("../lib/subjectKeyService.js", () => ({
  isEncryptedSubjectState: (value: unknown) =>
    typeof value === "string" && value.startsWith("enc:subject:"),
  decryptSubjectAuditState: async (_tenant: string, value: string) => {
    // The bug: decryption ran after the transaction callback returned, so the
    // subject-key lookup hit the root pool with no tenant GUC.
    if (!state.inTenantTransaction) throw new Error("decrypt ran outside the tenant transaction");
    return `decrypted:${value}`;
  },
}));

import { listAuditEventsForExport } from "../audit/repository/auditQueryAdapter.js";

describe("audit export tenant scope", () => {
  it("decrypts subject state inside the tenant transaction", async () => {
    const [row] = await listAuditEventsForExport("demo");
    expect(row?.oldState).toBe(`decrypted:${fakeRow.oldState}`);
    expect(row?.newState).toBeNull();
    expect(state.inTenantTransaction).toBe(false);
  });
});
