import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  Contact,
  ContactDuplicatePair,
  ContactsCommandMetricsSnapshot,
  ContactsMonthlyYearCounts,
  ContactsReportAnalyticsSnapshot,
  ContactsWidgetAggregateResult,
  ContactsWidgetQuery,
  FieldConfig,
  TabDefinition,
} from "@mms/shared";
import { runWithTenant } from "../lib/tenantContext.js";
import {
  loadContactsCommandMetrics,
  loadContactsReportAnalytics,
  loadContactsWidgetAggregates,
} from "../contacts/use-cases/contactAnalyticsUseCases.js";
import { loadContactFieldConfig } from "../contacts/use-cases/contactConfigService.js";
import { getDuplicateScanCache } from "../contacts/use-cases/contactDuplicateScanUseCases.js";
import type { ContactsRepository } from "../contacts/repository/contactsRepository.js";

vi.mock("../contacts/use-cases/contactConfigService.js", () => ({
  loadContactFieldConfig: vi.fn(),
}));

vi.mock("../contacts/use-cases/contactDuplicateScanUseCases.js", () => ({
  getDuplicateScanCache: vi.fn(),
}));

const TENANT = "tenant-analytics";

type ContactFieldConfigWithTabs = FieldConfig & { formTabs: TabDefinition[] };

function createPair(
  id: string,
  reasonKey: ContactDuplicatePair["reasonKey"],
): ContactDuplicatePair {
  return {
    id,
    confidence: 90,
    reasonKey,
    contacts: [
      { id: `c-${id}-a`, name: "Contact A" } as unknown as Contact,
      { id: `c-${id}-b`, name: "Contact B" } as unknown as Contact,
    ],
  };
}

describe("contactAnalyticsUseCases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loadContactsCommandMetrics", () => {
    it("given no tenant context bound, should return zero-filled metrics snapshot without querying repository", async () => {
      // Arrange
      const mockRepo = {
        aggregateCommandMetrics: vi.fn(),
      } as unknown as ContactsRepository;

      // Act
      const result = await loadContactsCommandMetrics(mockRepo);

      // Assert
      expect(result).toEqual({
        total: 0,
        newThisPeriod: 0,
        whatsappCount: 0,
        incompleteCount: 0,
        duplicatePairCount: 0,
      });
      expect(mockRepo.aggregateCommandMetrics).not.toHaveBeenCalled();
    });

    it("given active tenant and dupe cache with actionable pairs, should aggregate metrics with non-name pair count", async () => {
      // Arrange
      const mockFieldConfig: ContactFieldConfigWithTabs = {
        version: 1,
        enabledTabs: ["basic", "relationships"],
        requiredTabs: ["basic"],
        fields: { basic: [] },
        formTabs: [{ key: "basic", label: "Basic", enabled: true, order: 1 }],
      };
      vi.mocked(loadContactFieldConfig).mockResolvedValue(mockFieldConfig);
      vi.mocked(getDuplicateScanCache).mockResolvedValue({
        computedAt: "2026-03-01T00:00:00.000Z",
        contactCount: 100,
        pairCount: 3,
        pairs: [
          createPair("p1", "phone"),
          createPair("p2", "email"),
          createPair("p3", "name"), // excluded from duplicatePairCount
        ],
      });

      const expectedSnapshot: ContactsCommandMetricsSnapshot = {
        total: 100,
        newThisPeriod: 12,
        whatsappCount: 45,
        incompleteCount: 3,
        duplicatePairCount: 2,
      };

      const mockRepo = {
        aggregateCommandMetrics: vi.fn().mockResolvedValue(expectedSnapshot),
      } as unknown as ContactsRepository;

      // Act & Assert
      await runWithTenant(TENANT, async () => {
        const result = await loadContactsCommandMetrics(mockRepo);

        expect(result).toEqual(expectedSnapshot);
        expect(mockRepo.aggregateCommandMetrics).toHaveBeenCalledWith(
          TENANT,
          expect.objectContaining({ version: 1 }),
          { duplicatePairCount: 2 },
        );
      });
    });
  });

  describe("loadContactsReportAnalytics", () => {
    it("given no tenant context bound, should return zero-filled report analytics snapshot", async () => {
      // Arrange
      const mockRepo = {
        aggregateReportAnalytics: vi.fn(),
      } as unknown as ContactsRepository;

      // Act
      const result = await loadContactsReportAnalytics(undefined, mockRepo);

      // Assert
      expect(result.analytics.total).toBe(0);
      expect(result.analytics.activeCount).toBe(0);
      expect(result.monthlyByYear).toBeUndefined();
      expect(mockRepo.aggregateReportAnalytics).not.toHaveBeenCalled();
    });

    it("given active tenant without compareYears option, should aggregate report analytics without monthly counts", async () => {
      // Arrange
      const mockSnapshot: ContactsReportAnalyticsSnapshot = {
        total: 50,
        activeCount: 48,
        whatsappCount: 30,
        whatsappRate: 60,
        missingInfoCount: 2,
        newLast30Days: 8,
        newPrior30Days: 6,
        newThisPeriod: 8,
        hasSignupDates: true,
        growthRecentSignups30d: 33,
        growthPriorSignups30d: 10,
      };

      const mockRepo = {
        aggregateReportAnalytics: vi.fn().mockResolvedValue(mockSnapshot),
        aggregateMonthlyCreatedCounts: vi.fn(),
      } as unknown as ContactsRepository;

      // Act & Assert
      await runWithTenant(TENANT, async () => {
        const result = await loadContactsReportAnalytics(undefined, mockRepo);

        expect(result.analytics).toEqual(mockSnapshot);
        expect(result.monthlyByYear).toBeUndefined();
        expect(mockRepo.aggregateReportAnalytics).toHaveBeenCalledWith(TENANT);
        expect(mockRepo.aggregateMonthlyCreatedCounts).not.toHaveBeenCalled();
      });
    });

    it("given active tenant with compareYears option, should query monthly created counts", async () => {
      // Arrange
      const mockSnapshot: ContactsReportAnalyticsSnapshot = {
        total: 50,
        activeCount: 48,
        whatsappCount: 30,
        whatsappRate: 60,
        missingInfoCount: 2,
        newLast30Days: 8,
        newPrior30Days: 6,
        newThisPeriod: 8,
        hasSignupDates: true,
        growthRecentSignups30d: 33,
        growthPriorSignups30d: 10,
      };

      const mockMonthly: ContactsMonthlyYearCounts[] = [
        {
          year: 2026,
          months: [{ month: "Jan", count: 10 }],
        },
        {
          year: 2025,
          months: [{ month: "Jan", count: 8 }],
        },
      ];

      const mockRepo = {
        aggregateReportAnalytics: vi.fn().mockResolvedValue(mockSnapshot),
        aggregateMonthlyCreatedCounts: vi.fn().mockResolvedValue(mockMonthly),
      } as unknown as ContactsRepository;

      // Act & Assert
      await runWithTenant(TENANT, async () => {
        const result = await loadContactsReportAnalytics(
          { compareYears: [2026, 2025], language: "ur" },
          mockRepo,
        );

        expect(result.analytics).toEqual(mockSnapshot);
        expect(result.monthlyByYear).toEqual(mockMonthly);
        expect(mockRepo.aggregateMonthlyCreatedCounts).toHaveBeenCalledWith(
          TENANT,
          [2026, 2025],
          6,
          "ur",
        );
      });
    });
  });

  describe("loadContactsWidgetAggregates", () => {
    it("given no tenant context bound, should return empty object without querying repository", async () => {
      // Arrange
      const mockRepo = {
        aggregateWidgetQueries: vi.fn(),
      } as unknown as ContactsRepository;

      // Act
      const result = await loadContactsWidgetAggregates([], mockRepo);

      // Assert
      expect(result).toEqual({});
      expect(mockRepo.aggregateWidgetQueries).not.toHaveBeenCalled();
    });

    it("given active tenant, should delegate widget queries to repository", async () => {
      // Arrange
      const queries: ContactsWidgetQuery[] = [{ id: "w1", operation: "count" }];
      const mockResult: Record<string, ContactsWidgetAggregateResult> = {
        w1: { value: 75, totalCount: 100, chartData: [{ name: "Active", value: 75 }] },
      };

      const mockRepo = {
        aggregateWidgetQueries: vi.fn().mockResolvedValue(mockResult),
      } as unknown as ContactsRepository;

      // Act & Assert
      await runWithTenant(TENANT, async () => {
        const result = await loadContactsWidgetAggregates(queries, mockRepo);

        expect(result).toEqual(mockResult);
        expect(mockRepo.aggregateWidgetQueries).toHaveBeenCalledWith(TENANT, queries);
      });
    });
  });
});
