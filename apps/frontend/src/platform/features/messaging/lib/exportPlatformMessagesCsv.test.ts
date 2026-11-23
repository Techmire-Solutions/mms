import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlatformMessageDto } from "@mms/shared";
import { exportPlatformMessagesCsv } from "@/platform/features/messaging/lib/exportPlatformMessagesCsv";

const triggerDownload = vi.fn();

vi.mock("@/lib/download", () => ({
  triggerFileDownload: (...args: unknown[]) => triggerDownload(...args),
}));

const message: PlatformMessageDto = {
  id: "m1",
  channel: "email",
  subject: "Welcome",
  body: "hi",
  status: "sent",
  recipientSnapshot: [{ contactId: "c1", name: "Ali", channel: "email", address: "a@b.co" }],
  scheduledAt: null,
  sentAt: "2026-01-01T00:00:00.000Z",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("exportPlatformMessagesCsv", () => {
  beforeEach(() => triggerDownload.mockReset());

  it("downloads a CSV with recipient count and status", () => {
    exportPlatformMessagesCsv([message]);

    expect(triggerDownload).toHaveBeenCalledTimes(1);
    const blob = triggerDownload.mock.calls[0]?.[0] as Blob;
    return blob.text().then((csv) => {
      expect(csv).toContain("Welcome");
      expect(csv).toContain("sent");
      expect(csv).toContain("1");
      expect(csv.split("\n")).toHaveLength(2);
    });
  });

  it("does not download for an empty log", () => {
    exportPlatformMessagesCsv([]);
    expect(triggerDownload).not.toHaveBeenCalled();
  });
});
