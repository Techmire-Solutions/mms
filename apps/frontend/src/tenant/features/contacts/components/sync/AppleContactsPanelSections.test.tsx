import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  AppleContactsExportGuide,
  AppleContactsImportResult,
  AppleContactsExportBar,
  AppleContactsFileInput,
} from "./AppleContactsPanelSections";

describe("AppleContactsPanelSections Components", () => {
  it("renders export guide correctly", () => {
    const html = renderToStaticMarkup(<AppleContactsExportGuide t={((k: string) => k) as any} />);

    expect(html).toContain("contacts.sync.appleExportTitle");
  });

  it("renders import result message", () => {
    const html = renderToStaticMarkup(
      <AppleContactsImportResult
        result={{ imported: 12, skipped: 2 }}
        t={((k: string, params: any) => `${k}:${params?.count ?? ""}`) as any}
      />,
    );

    expect(html).toContain("contacts.sync.importComplete");
    expect(html).toContain("12");
  });

  it("renders export bar button", () => {
    const html = renderToStaticMarkup(
      <AppleContactsExportBar
        contactCount={25}
        exporting={false}
        onExport={vi.fn()}
        t={((k: string) => k) as any}
      />,
    );

    expect(html).toContain("contacts.sync.exportAppleHint");
  });

  it("renders hidden file input", () => {
    const fileRef = { current: null };
    const html = renderToStaticMarkup(
      <AppleContactsFileInput fileRef={fileRef} onChange={vi.fn()} t={((k: string) => k) as any} />,
    );

    expect(html).toContain('type="file"');
    expect(html).toContain('accept=".vcf,text/vcard,.csv,text/csv"');
  });
});
