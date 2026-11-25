import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AppleContactsPanel } from "./AppleContactsPanel.js";

vi.mock("@mms/fe-core/i18n", async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("../../hooks/useAppleContactsPanel", () => ({
  useAppleContactsPanel: () => ({
    previewList: [],
    importing: false,
    exporting: false,
    exportCount: 15,
    result: null,
    isDragging: false,
    fileRef: { current: null },
    openFilePicker: vi.fn(),
    setIsDragging: vi.fn(),
    handleDroppedFiles: vi.fn(),
    clearPreview: vi.fn(),
    handleImport: vi.fn(),
    chooseDifferentFile: vi.fn(),
    handleFile: vi.fn(),
    handleExport: vi.fn(),
  }),
}));

vi.mock("@mms/ui/app/DashedFileDropZone", async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  DashedFileDropZone: ({ title }: { title: string }) => <div data-testid="dropzone">{title}</div>,
}));

describe("AppleContactsPanel Component", () => {
  it("renders panel with export guide and dropzone when canWrite is true", () => {
    const html = renderToStaticMarkup(<AppleContactsPanel onImport={vi.fn()} canWrite={true} />);

    expect(html).toContain("contacts.sync.appleTitle");
    expect(html).toContain("contacts.sync.uploadVcf");
  });
});
