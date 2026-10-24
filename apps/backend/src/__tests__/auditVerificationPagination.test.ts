import crypto from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { canonicalizeJson, formatAuditEventHashInput, GENESIS_AUDIT_HASH } from "@mms/shared";

const state = vi.hoisted(() => ({
  pages: [] as unknown[][],
  pageIndex: 0,
  inserted: [] as unknown[],
}));

interface Chain {
  select: () => Chain;
  from: () => Chain;
  where: () => Chain;
  orderBy: () => Chain;
  limit: () => Promise<unknown[]>;
}

vi.mock("../db/dbConnection.js", () => {
  const makeChain = (): Chain => {
    const chain: Chain = {
      select: () => chain,
      from: () => chain,
      where: () => chain,
      orderBy: () => chain,
      limit: () => Promise.resolve(state.pages[state.pageIndex++] ?? []),
    };
    return chain;
  };
  return {
    activeDb: () => ({
      ...makeChain(),
      insert: () => ({
        values: (row: unknown) => {
          state.inserted.push(row);
          return Promise.resolve(undefined);
        },
      }),
    }),
  };
});

import { verifyTenantAuditChain } from "../services/auditVerificationService.js";

const SUBDOMAIN = "demo";

interface RawEvent {
  id: number;
  tableName: string;
  recordId: string;
  actionType: string;
  realUserId: string;
  impersonatedUserId: null;
  ipAddress: null;
  clientApp: null;
  sessionId: null;
  correlationId: string;
  apiEndpoint: null;
  httpMethod: null;
  oldState: null;
  newState: null;
  transactionTimestamp: Date;
}

function buildChain(
  hashes: string[],
): (RawEvent & { hashPrevious: string; hashCurrent: string })[] {
  let previous = GENESIS_AUDIT_HASH;
  return hashes.map((hashCurrent, index) => {
    const raw: RawEvent = {
      id: index + 1,
      tableName: "students",
      recordId: `rec-${index}`,
      actionType: "CREATE",
      realUserId: "u1",
      impersonatedUserId: null,
      ipAddress: null,
      clientApp: null,
      sessionId: null,
      correlationId: `corr-${index}`,
      apiEndpoint: null,
      httpMethod: null,
      oldState: null,
      newState: null,
      transactionTimestamp: new Date(Date.UTC(2026, 0, 1, 0, 0, index)),
    };
    const canonical = canonicalizeJson({
      actionType: raw.actionType,
      apiEndpoint: raw.apiEndpoint,
      clientApp: raw.clientApp,
      correlationId: raw.correlationId,
      httpMethod: raw.httpMethod,
      impersonatedUserId: raw.impersonatedUserId,
      ipAddress: raw.ipAddress,
      newState: raw.newState,
      oldState: raw.oldState,
      realUserId: raw.realUserId,
      recordId: raw.recordId,
      sessionId: raw.sessionId,
      tableName: raw.tableName,
      workspaceSubdomain: SUBDOMAIN,
    });
    const hashPrevious = previous;
    const expected = crypto.hash(
      "sha256",
      formatAuditEventHashInput(hashPrevious, canonical, raw.transactionTimestamp.toISOString()),
      "hex",
    );
    previous = expected;
    return {
      ...raw,
      hashPrevious,
      hashCurrent: hashCurrent === "compute" ? expected : hashCurrent,
    };
  });
}

beforeEach(() => {
  state.pages = [];
  state.pageIndex = 0;
  state.inserted.length = 0;
});

describe("verifyTenantAuditChain pagination", () => {
  it("verifies records past the first page and reports tampering", async () => {
    const events = buildChain(["compute", "compute", "tampered"]);
    state.pages = [events.slice(0, 2), events.slice(2)];

    const result = await verifyTenantAuditChain(SUBDOMAIN, { limit: 2 });

    expect(result.recordsChecked).toBe(3);
    expect(result.status).toBe("TAMPERED");
    expect(state.inserted[0]).toMatchObject({ recordsChecked: 3, status: "TAMPERED" });
  });

  it("reports VERIFIED across multiple intact pages", async () => {
    const events = buildChain(["compute", "compute", "compute"]);
    state.pages = [events.slice(0, 2), events.slice(2)];

    const result = await verifyTenantAuditChain(SUBDOMAIN, { limit: 2 });

    expect(result.recordsChecked).toBe(3);
    expect(result.status).toBe("VERIFIED");
    expect(result.discrepancies).toEqual([]);
    expect(result.headHash).toBe(events[2].hashCurrent);
  });
});
