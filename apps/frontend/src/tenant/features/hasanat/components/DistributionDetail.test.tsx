import React, { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DocumentTemplate } from "@mms/shared";
import { createRoot } from "react-dom/client";
import type { Denomination, Distribution } from "@/lib/data/hasanatData";
import { DistributionDetail } from "./DistributionDetail";
import { fetchDocumentTemplateServer } from "@/lib/templates/documentTemplatesApi";
import { writeCachedDocumentTemplate } from "@/lib/templates/documentTemplateCache";
import { HASANAT_TEMPLATE_STORAGE_KEY } from "../lib/hasanatTemplateData";
import { notify } from "@/lib/notify";
import { withQueryClient } from "@/test/queryClientTestUtils";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key, language: "en", isRtl: false }),
}));

vi.mock("@/tenant/hooks/useBranding", () => ({
  useBranding: () => ({ madrasaName: "Test Madrasa", logoUrl: null }),
}));

vi.mock("@/lib/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("@/lib/templates/documentTemplatesApi", () => ({
  fetchDocumentTemplateServer: vi.fn().mockResolvedValue(null),
  saveDocumentTemplateServer: vi.fn().mockImplementation(async (_key, template) => template),
  deleteDocumentTemplateServer: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/components/app/DetailDrawerShell", () => ({
  DetailDrawerShell: ({
    children,
    headerActions,
  }: {
    children?: React.ReactNode;
    headerActions?: React.ReactNode;
  }) => (
    <div data-testid="drawer">
      {headerActions}
      {children}
    </div>
  ),
}));

const distribution = {
  id: "dist-1",
  batchId: "batch-1",
  denominationId: "denom-1",
  denominationName: "Silver Deed (10 Pts)",
  recipientType: "student",
  recipientName: "Zaid bin Harith",
  recipientClass: "Class 2",
  quantity: 2,
  reason: "Quranic Excellence Reward",
  issuedDate: "2026-09-12",
  issuedBy: "Admin Office",
  status: "active",
} as Distribution;

const denomination = { id: "denom-1", name: "Silver Deed", points: 10 } as Denomination;

const customTemplate: DocumentTemplate = {
  pageSize: "A6",
  orientation: "landscape",
  elements: [
    { id: "v", type: "static", label: "VOUCHER", x: 10, y: 10, w: 200, h: 20 },
    {
      id: "to",
      type: "field",
      field: "recipientName",
      label: "Recipient",
      x: 10,
      y: 40,
      w: 300,
      h: 20,
    },
    {
      id: "pts",
      type: "field",
      field: "totalPoints",
      label: "Points",
      x: 10,
      y: 70,
      w: 300,
      h: 20,
    },
  ],
};

function fakePrintWindow() {
  return {
    opener: null as unknown,
    document: { write: vi.fn(), close: vi.fn() },
    addEventListener: vi.fn(),
    focus: vi.fn(),
    print: vi.fn(),
  };
}

async function renderDetail(denom: Denomination | null): Promise<HTMLDivElement> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      withQueryClient(
        <DistributionDetail distribution={distribution} denomination={denom} onClose={vi.fn()} />,
      ),
    );
  });
  return container;
}

describe("DistributionDetail voucher printing", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(fetchDocumentTemplateServer).mockResolvedValue(customTemplate as never);
    writeCachedDocumentTemplate(HASANAT_TEMPLATE_STORAGE_KEY, customTemplate);
  });

  it("prints the saved voucher layout with the recipient and points", async () => {
    const win = fakePrintWindow();
    const openSpy = vi.spyOn(window, "open").mockReturnValue(win as unknown as Window);
    const container = await renderDetail(denomination);

    const printButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("hasanat.detail.printVoucher"),
    );
    expect(printButton).toBeTruthy();

    await act(async () => {
      printButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(openSpy).toHaveBeenCalledTimes(1);
    const written = win.document.write.mock.calls[0]?.[0] as string;
    expect(written).toContain("VOUCHER");
    expect(written).toContain("Zaid bin Harith");
    expect(written).toContain("20 Hasanat");
    openSpy.mockRestore();
  });

  it("reports a blocked popup", async () => {
    const openSpy = vi.spyOn(window, "open").mockReturnValue(null);
    const container = await renderDetail(null);

    const printButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("hasanat.detail.printVoucher"),
    );
    await act(async () => {
      printButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(notify.error).toHaveBeenCalledWith("templateEditor.exportFailed");
    openSpy.mockRestore();
  });
});
