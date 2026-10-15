import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  useAttendancePaginated,
  useAttendanceRecords,
  useAttendanceRecordsCollection,
  useAttendanceMutations,
  useAttendanceReportAggregates,
  useAttendanceMetrics,
} from "./useAttendance";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const attendanceApiMocks = vi.hoisted(() => ({
  listUseQuery: vi.fn(() => ({
    data: {
      body: {
        records: [{ id: "rec-1", studentName: "Bilal" }],
        total: 1,
        page: 1,
        limit: 25,
      },
    },
    isLoading: false,
  })),
  reportUseQuery: vi.fn(() => ({
    data: {
      status: 200,
      body: {
        overview: {
          overallRate: 85,
          totalRecords: 10,
          lowAttendanceCount: 1,
          classRates: [],
          monthlyTrend: [],
          studentRates: [],
          topPerformers: [],
          statusCounts: [],
        },
      },
    },
    isLoading: false,
  })),
}));

vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => ({
    isAuthenticated: true,
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: { overallRate: 85 },
    isLoading: false,
  }),
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}));

vi.mock("@/lib/api", () => ({
  tsrClient: {
    attendance: {
      list: {
        useQuery: attendanceApiMocks.listUseQuery,
      },
      reportAggregates: {
        useQuery: attendanceApiMocks.reportUseQuery,
      },
      bulk: { useMutation: () => ({ mutateAsync: vi.fn() }) },
      create: { useMutation: () => ({ mutateAsync: vi.fn() }) },
      update: { useMutation: () => ({ mutateAsync: vi.fn() }) },
      delete: { useMutation: () => ({ mutateAsync: vi.fn() }) },
      restore: { useMutation: () => ({ mutateAsync: vi.fn() }) },
      bulkDelete: { useMutation: () => ({ mutateAsync: vi.fn() }) },
      bulkRestore: { useMutation: () => ({ mutateAsync: vi.fn() }) },
    },
  },
}));

vi.mock("@/hooks/useServerMetrics", () => ({
  useServerMetrics: () => ({
    data: { totalPresent: 50 },
    isLoading: false,
  }),
}));

describe("useAttendance Hook suite", () => {
  let container: HTMLDivElement | null = null;

  beforeEach(() => {
    attendanceApiMocks.listUseQuery.mockClear();
    attendanceApiMocks.reportUseQuery.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (container) {
      document.body.removeChild(container);
      container = null;
    }
  });

  it("provides paginated and collection attendance queries and mutations", async () => {
    let paginatedResult!: ReturnType<typeof useAttendancePaginated>;
    let recordsResult!: ReturnType<typeof useAttendanceRecords>;
    let collectionResult!: ReturnType<typeof useAttendanceRecordsCollection>;
    let mutationsResult!: ReturnType<typeof useAttendanceMutations>;
    let reportResult!: ReturnType<typeof useAttendanceReportAggregates>;
    let metricsResult!: ReturnType<typeof useAttendanceMetrics>;

    function TestComponent() {
      paginatedResult = useAttendancePaginated({ page: 1 });
      recordsResult = useAttendanceRecords();
      collectionResult = useAttendanceRecordsCollection();
      mutationsResult = useAttendanceMutations();
      reportResult = useAttendanceReportAggregates();
      metricsResult = useAttendanceMetrics("2025-01-01");
      return null;
    }

    await act(async () => {
      const root = createRoot(container!);
      root.render(React.createElement(TestComponent));
    });

    expect(paginatedResult.data?.records.length).toBe(1);
    expect(recordsResult.data.length).toBe(1);
    expect(collectionResult.length).toBe(1);
    expect(mutationsResult.createRecord).toBeDefined();
    expect(reportResult.data).toBeDefined();
    expect(reportResult.data.overview.overallRate).toBe(85);
    expect(metricsResult.data).toBeDefined();
  });

  it("sends session and faculty filters with the paginated request", async () => {
    function TestComponent() {
      useAttendancePaginated({
        page: 2,
        sessionId: " session-1 ",
        facultyId: " faculty-1 ",
      });
      return null;
    }

    await act(async () => {
      const root = createRoot(container!);
      root.render(React.createElement(TestComponent));
    });

    expect(attendanceApiMocks.listUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryData: {
          query: expect.objectContaining({
            page: 2,
            sessionId: "session-1",
            facultyId: "faculty-1",
          }),
        },
      }),
    );
  });
});
