import { beforeEach, describe, expect, it, vi } from "vitest";
import { MESSAGING_CSV_EXPORT_MAX_ROWS } from "@mms/shared";
import {
  buildMessagingCsvExport,
  MessagingCsvExportLimitError,
} from "../services/messagingExportService.js";

const mockLoadFilteredMessageLogs = vi.fn();
const mockResolveMessagingRecipients = vi.fn();

vi.mock("../services/messagingService.js", () => ({
  loadFilteredMessageLogs: (...args: unknown[]) => mockLoadFilteredMessageLogs(...args),
  resolveMessagingRecipients: (...args: unknown[]) => mockResolveMessagingRecipients(...args),
}));

describe("buildMessagingCsvExport", () => {
  beforeEach(() => {
    mockLoadFilteredMessageLogs.mockReset();
    mockResolveMessagingRecipients.mockReset().mockResolvedValue([]);
  });

  it("fails when matched total exceeds the row cap", async () => {
    mockLoadFilteredMessageLogs.mockResolvedValueOnce({
      logs: [],
      total: MESSAGING_CSV_EXPORT_MAX_ROWS + 1,
      page: 1,
      pageSize: 500,
      hasMore: false,
    });

    await expect(buildMessagingCsvExport("demo", {})).rejects.toBeInstanceOf(
      MessagingCsvExportLimitError,
    );
  });

  it("builds CSV for a small page under the cap", async () => {
    mockLoadFilteredMessageLogs.mockResolvedValueOnce({
      logs: [
        {
          id: "1",
          userId: "u1",
          contactId: "c1",
          channel: "sms",
          body: "Hello",
          sentAt: "2026-01-01T00:00:00.000Z",
          status: "sent",
          category: "general",
        },
      ],
      total: 1,
      page: 1,
      pageSize: 500,
      hasMore: false,
    });
    mockResolveMessagingRecipients.mockResolvedValueOnce([
      { id: "c1", name: "Ali", phone: "+923001234567" },
    ]);

    const result = await buildMessagingCsvExport("demo", { channel: "sms" });
    expect(result.count).toBe(1);
    expect(result.csv).toContain("Ali");
    expect(result.csv).toContain("Hello");
  });
});
