import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TenantMessageComposerRecipientTable } from "./TenantMessageComposerRecipientTable";
import type { StandardMessagingRecipient } from "@mms/shared";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (params?.name) return `${key}:${params.name}`;
      return key;
    },
  }),
}));

describe("TenantMessageComposerRecipientTable", () => {
  const sampleRecipients: StandardMessagingRecipient[] = [
    { id: "1", name: "Zaid Khan", phone: "+923001234567", email: "zaid@example.com" },
    { id: "2", name: "Bilal Ahmed", phone: "", email: "" },
  ];

  it("renders recipient rows and missing badges", () => {
    const html = renderToStaticMarkup(
      <TenantMessageComposerRecipientTable
        recipients={sampleRecipients}
        selectedIds={new Set(["1"])}
        onToggle={vi.fn()}
        onToggleAll={vi.fn()}
        allSelected={false}
        someSelected={true}
      />,
    );

    expect(html).toContain("Zaid Khan");
    expect(html).toContain("Bilal Ahmed");
    expect(html).toContain("+923001234567");
    expect(html).toContain("zaid@example.com");
    expect(html).toContain("messaging.missingPhone");
    expect(html).toContain("messaging.missingEmail");
  });
});
