import { beforeEach, describe, expect, it, vi } from "vitest";

const { state } = vi.hoisted(() => ({
  state: {
    executedSql: [] as unknown[],
    selectRows: [] as unknown[],
  },
}));

vi.mock("@mms/db/context", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@mms/db/context")>()),

  withTenant: async (_tenant: string, callback: (tx: unknown) => Promise<unknown>) =>
    callback({
      execute: async (sqlVal: unknown) => {
        state.executedSql.push(sqlVal);
        return {
          rows: [
            {
              total: 10,
              sms_count: 5,
              whatsapp_count: 3,
              email_count: 2,
              sent_count: 6,
              delivered_count: 2,
              failed_count: 1,
              skipped_count: 1,
              queued_count: 0,
              cat_general: 4,
              cat_academic: 3,
              cat_financial: 2,
              cat_attendance: 1,
              cat_emergency: 0,
            },
          ],
        };
      },
      select: () => ({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: () => ({
                offset: async () => state.selectRows,
              }),
            }),
          }),
        }),
      }),
    }),
}));

import {
  queryFilteredMessageLogs,
  queryMessagingMetrics,
} from "../repository/db/messagingLogsQueryRepository.js";

describe("messagingLogsQueryRepository", () => {
  beforeEach(() => {
    state.executedSql = [];
    state.selectRows = [];
  });

  describe("queryFilteredMessageLogs", () => {
    it("returns empty result on blank or missing subdomain without executing DB query", async () => {
      const res = await queryFilteredMessageLogs("");
      expect(res).toEqual({
        logs: [],
        total: 0,
        page: 1,
        pageSize: 50,
        hasMore: false,
      });

      const whitespaceRes = await queryFilteredMessageLogs("   ");
      expect(whitespaceRes.total).toBe(0);
      expect(whitespaceRes.logs).toEqual([]);
    });

    it("clamps pageSize to max allowable ceiling (100)", async () => {
      const res = await queryFilteredMessageLogs("", { pageSize: 999 });
      expect(res.pageSize).toBe(100);
    });
  });

  describe("queryMessagingMetrics", () => {
    it("returns zeroed metrics on blank or missing subdomain", async () => {
      const res = await queryMessagingMetrics("");
      expect(res.total).toBe(0);
      expect(res.smsCount).toBe(0);
      expect(res.sentCount).toBe(0);
      expect(res.categoryBreakdown.general).toBe(0);
      expect(state.executedSql).toHaveLength(0);
    });

    it("executes metrics query and formats result properly when subdomain is provided", async () => {
      const res = await queryMessagingMetrics("demo", {
        startDate: "2026-11-01",
        endDate: "2026-11-18",
      });
      expect(res.total).toBe(10);
      expect(res.smsCount).toBe(5);
      expect(res.whatsappCount).toBe(3);
      expect(res.emailCount).toBe(2);
      expect(res.deliveredCount).toBe(2);
      expect(res.successRate).toBe(89);
      expect(state.executedSql).toHaveLength(1);
    });
  });
});
