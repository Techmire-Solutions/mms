import { describe, expect, it, vi } from "vitest";
import {
  getPreparedTenantUserById,
  getPreparedContactById,
  getPreparedStudentById,
  getPreparedSessionById,
  resetPreparedStatements,
} from "../db/preparedStatements.js";
import {
  loadContactChildMapsAggregated,
  loadContactSummaryChildMapsAggregated,
} from "../db/repositories/contactRepositoryHydrateChildren.js";
import { hydrateSessionsListAggregated } from "../db/repositories/sessionRepositoryHydrate.js";

describe("Drizzle Query Optimization & Prepared Statements", () => {
  it("compiles prepared statements on mock or real client", () => {
    resetPreparedStatements();

    const mockPrepare = vi.fn().mockReturnValue({ execute: vi.fn() });
    const mockLimit = vi.fn().mockReturnValue({ prepare: mockPrepare });
    const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

    const mockDb = { select: mockSelect };

    const prepUser = getPreparedTenantUserById(mockDb);
    expect(mockSelect).toHaveBeenCalled();
    expect(mockPrepare).toHaveBeenCalledWith("prepared_find_tenant_user_by_id");
    expect(prepUser).toBeTruthy();

    const prepContact = getPreparedContactById(mockDb);
    expect(mockPrepare).toHaveBeenCalledWith("prepared_find_contact_by_id");
    expect(prepContact).toBeTruthy();

    const prepStudent = getPreparedStudentById(mockDb);
    expect(mockPrepare).toHaveBeenCalledWith("prepared_find_student_by_id");
    expect(prepStudent).toBeTruthy();

    const prepSession = getPreparedSessionById(mockDb);
    expect(mockPrepare).toHaveBeenCalledWith("prepared_find_session_by_id");
    expect(prepSession).toBeTruthy();

    resetPreparedStatements();
  });

  it("loadContactChildMapsAggregated returns empty maps for empty contactIds", async () => {
    const mockTx = { execute: vi.fn() } as any;
    const result = await loadContactChildMapsAggregated(mockTx, "test-subdomain", []);

    expect(result.phonesMap.size).toBe(0);
    expect(result.emailsMap.size).toBe(0);
    expect(result.addressesMap.size).toBe(0);
    expect(result.tagsMap.size).toBe(0);
    expect(mockTx.execute).not.toHaveBeenCalled();
  });

  it("loadContactChildMapsAggregated executes single SQL query and maps all 12 collections", async () => {
    const mockTx = {
      execute: vi.fn().mockResolvedValue([
        {
          contactId: "c1",
          phones: [{ id: "p1", number: "+1234567890", sortOrder: 0 }],
          emails: [{ id: "e1", address: "c1@example.com", sortOrder: 0 }],
          addresses: [{ id: "a1", line1: "123 Main St", city: "Metropolis", sortOrder: 0 }],
          tags: [{ id: "t1", name: "VIP" }],
          socials: [{ id: "s1", platform: "twitter", url: "https://twitter.com/c1", sortOrder: 0 }],
          educations: [{ id: "ed1", institution: "University", sortOrder: 0 }],
          experiences: [{ id: "ex1", company: "Tech Inc", sortOrder: 0 }],
          skills: [{ id: "sk1", name: "TypeScript", sortOrder: 0 }],
          relationships: [{ id: "r1", name: "Father", relationship: "Parent", sortOrder: 0 }],
          activities: [{ id: "act1", type: "call", content: "Follow-up", sortOrder: 0 }],
          attachments: [
            { id: "att1", name: "doc.pdf", url: "https://example.com/doc.pdf", sortOrder: 0 },
          ],
          bankDetails: [{ id: "bd1", bankName: "Global Bank", sortOrder: 0 }],
        },
      ]),
    } as any;

    const result = await loadContactChildMapsAggregated(mockTx, "test-subdomain", ["c1"]);

    expect(mockTx.execute).toHaveBeenCalledTimes(1);
    expect(result.phonesMap.get("c1")).toHaveLength(1);
    expect(result.emailsMap.get("c1")).toHaveLength(1);
    expect(result.addressesMap.get("c1")).toHaveLength(1);
    expect(result.tagsMap.get("c1")).toHaveLength(1);
    expect(result.socialsMap.get("c1")).toHaveLength(1);
    expect(result.educationsMap.get("c1")).toHaveLength(1);
    expect(result.experiencesMap.get("c1")).toHaveLength(1);
    expect(result.skillsMap.get("c1")).toHaveLength(1);
    expect(result.relationshipsMap.get("c1")).toHaveLength(1);
    expect(result.activitiesMap.get("c1")).toHaveLength(1);
    expect(result.attachmentsMap.get("c1")).toHaveLength(1);
    expect(result.bankDetailsMap.get("c1")).toHaveLength(1);
  });

  it("loadContactSummaryChildMapsAggregated executes single SQL query and maps summary collections", async () => {
    const mockTx = {
      execute: vi.fn().mockResolvedValue([
        {
          contactId: "c2",
          phones: [{ id: "p2", number: "+9876543210" }],
          emails: [{ id: "e2", address: "c2@example.com" }],
          addresses: [{ id: "a2", line1: "456 Side St" }],
          tags: [{ id: "t2", name: "Staff" }],
          socials: [{ id: "s2", platform: "linkedin" }],
          relationships: [{ id: "r2", name: "Mother", relationship: "Parent" }],
        },
      ]),
    } as any;

    const result = await loadContactSummaryChildMapsAggregated(mockTx, "test-subdomain", ["c2"]);

    expect(mockTx.execute).toHaveBeenCalledTimes(1);
    expect(result.phonesMap.get("c2")).toHaveLength(1);
    expect(result.emailsMap.get("c2")).toHaveLength(1);
    expect(result.addressesMap.get("c2")).toHaveLength(1);
    expect(result.tagsMap.get("c2")).toHaveLength(1);
    expect(result.socialsMap.get("c2")).toHaveLength(1);
    expect(result.relationshipsMap.get("c2")).toHaveLength(1);
    expect(result.educationsMap.size).toBe(0);
    expect(result.experiencesMap.size).toBe(0);
  });

  it("hydrateSessionsListAggregated executes single SQL query for session hydration", async () => {
    const mockTx = {
      execute: vi.fn().mockResolvedValue([
        {
          sessionId: "s1",
          faculty: [
            {
              id: "f1",
              sessionId: "s1",
              facultyId: "fac-1",
              facultyName: "Sheikh Ali",
              role: "teacher",
            },
          ],
          classes: [
            {
              id: "c1",
              sessionId: "s1",
              name: "Class A",
              gender: "male",
              fees: [{ id: "fee1", sessionClassId: "c1", feeType: "Tuition", amount: "100" }],
              schedules: [],
              budgets: [],
              discounts: [],
              timetables: [],
              refreshments: [],
              scholarships: [],
            },
          ],
        },
      ]),
    } as any;

    const dummySessionRow = {
      id: "s1",
      workspaceSubdomain: "sub",
      name: "Session 1",
      type: "term",
      status: "active",
      startDate: "2026-01-01",
      endDate: "2026-06-30",
      baseFee: "100",
      currency: "USD",
      description: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      deletedBy: null,
      deletionReason: null,
      deletedWithCascade: null,
      restoredAt: null,
      restoredBy: null,
    };

    const result = await hydrateSessionsListAggregated(mockTx, "sub", [dummySessionRow as any]);

    expect(mockTx.execute).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("s1");
    expect(result[0].faculty).toHaveLength(1);
    expect(result[0].classes).toHaveLength(1);
    expect(result[0].classes[0].fees).toHaveLength(1);
  });
});
