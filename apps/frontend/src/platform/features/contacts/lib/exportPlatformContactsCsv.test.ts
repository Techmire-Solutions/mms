import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlatformContactDto } from "@mms/shared";
import { exportPlatformContactsCsv } from "@/platform/features/contacts/lib/exportPlatformContactsCsv";

const triggerDownload = vi.fn();

vi.mock("@/lib/download", () => ({
  triggerFileDownload: (...args: unknown[]) => triggerDownload(...args),
}));

const contact: PlatformContactDto = {
  id: "c1",
  name: 'Ali, "Jr."',
  email: "ali@example.com",
  phone: "+15550000",
  kind: "external",
  workspaceId: null,
  tags: [{ id: "t1", label: "VIP" }],
  notes: "note",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  deletedAt: null,
};

describe("exportPlatformContactsCsv", () => {
  beforeEach(() => triggerDownload.mockReset());

  it("escapes quotes and joins tags, downloading a CSV blob", () => {
    exportPlatformContactsCsv([contact]);

    expect(triggerDownload).toHaveBeenCalledTimes(1);
    const blob = triggerDownload.mock.calls[0]?.[0] as Blob;
    expect(blob).toBeInstanceOf(Blob);

    return blob.text().then((csv) => {
      expect(csv).toContain('"Ali, ""Jr."""');
      expect(csv).toContain("VIP");
      expect(csv.split("\n")).toHaveLength(2);
    });
  });

  it("does not download for an empty directory", () => {
    exportPlatformContactsCsv([]);
    expect(triggerDownload).not.toHaveBeenCalled();
  });
});
