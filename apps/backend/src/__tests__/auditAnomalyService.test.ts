import { describe, expect, it } from "vitest";
import { detectAuditAnomalies } from "../services/auditAnomalyService.js";
import type { DbOrTransaction } from "../services/auditTrailService.js";

describe("auditAnomalyService - Section 6 Anomaly Detection", () => {
  function createMockDb(mockEvents: unknown[]): DbOrTransaction {
    return {
      select: () => ({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: () => Promise.resolve(mockEvents),
            }),
          }),
        }),
      }),
    } as unknown as DbOrTransaction;
  }

  it("returns empty anomalies when event count is within normal baseline", async () => {
    const mockDb = createMockDb([]);
    const report = await detectAuditAnomalies("test-ws-empty", { windowHours: 24 }, mockDb);
    expect(report.workspaceSubdomain).toBe("test-ws-empty");
    expect(report.anomalies).toEqual([]);
    expect(report.evaluatedAt).toBeDefined();
  });

  it("detects volume spike when user exceeds 100 events in window", async () => {
    const mockEvents = Array.from({ length: 105 }, (_, i) => ({
      id: i + 1,
      realUserId: "usr-spammer",
      actionType: "UPDATE",
      ipAddress: "192.168.1.1",
      transactionTimestamp: new Date("2026-09-09T14:00:00Z"),
    }));

    const mockDb = createMockDb(mockEvents);
    const report = await detectAuditAnomalies("demo", { windowHours: 24 }, mockDb);

    expect(
      report.anomalies.some((a) => a.type === "VOLUME_SPIKE" && a.userId === "usr-spammer"),
    ).toBe(true);
  });

  it("detects geographically implausible multi-IP access for same user", async () => {
    const mockEvents = [
      {
        id: 1,
        realUserId: "usr-traveler",
        actionType: "LOGIN",
        ipAddress: "1.1.1.1",
        transactionTimestamp: new Date("2026-09-09T10:00:00Z"),
      },
      {
        id: 2,
        realUserId: "usr-traveler",
        actionType: "VIEW",
        ipAddress: "2.2.2.2",
        transactionTimestamp: new Date("2026-09-09T10:15:00Z"),
      },
      {
        id: 3,
        realUserId: "usr-traveler",
        actionType: "UPDATE",
        ipAddress: "3.3.3.3",
        transactionTimestamp: new Date("2026-09-09T10:30:00Z"),
      },
    ];

    const mockDb = createMockDb(mockEvents);
    const report = await detectAuditAnomalies("demo", { windowHours: 24 }, mockDb);

    expect(
      report.anomalies.some((a) => a.type === "MULTI_IP_ACCESS" && a.userId === "usr-traveler"),
    ).toBe(true);
  });

  it("detects after-hours destructive or redaction operations", async () => {
    // 03:00 UTC is outside standard business hours (22:00 - 05:00 UTC)
    const mockEvents = [
      {
        id: 1,
        realUserId: "usr-night-owl",
        actionType: "DELETE",
        ipAddress: "192.168.1.5",
        transactionTimestamp: new Date("2026-09-09T03:00:00Z"),
      },
    ];

    const mockDb = createMockDb(mockEvents);
    const report = await detectAuditAnomalies("demo", { windowHours: 24 }, mockDb);

    expect(report.anomalies.some((a) => a.type === "AFTER_HOURS_ACTIVITY")).toBe(true);
  });
});
