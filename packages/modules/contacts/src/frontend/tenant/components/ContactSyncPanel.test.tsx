import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ContactSyncPanel } from "./ContactSyncPanel.js";

vi.mock("./sync/GoogleContactsPanel.js", () => ({
  GoogleContactsPanel: () => <div data-testid="google-sync-panel">Google Contacts Sync</div>,
}));

vi.mock("./sync/AppleContactsPanel.js", () => ({
  AppleContactsPanel: () => <div data-testid="apple-sync-panel">Apple Contacts Sync</div>,
}));

vi.mock("@mms/fe-core/i18n", async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("ContactSyncPanel Component", () => {
  it("renders info callout and both Google and Apple sync panels", () => {
    const html = renderToStaticMarkup(<ContactSyncPanel onImport={vi.fn()} canWrite={true} />);

    expect(html).toContain("contacts.sync.title");
    expect(html).toContain("Google Contacts Sync");
    expect(html).toContain("Apple Contacts Sync");
  });
});
