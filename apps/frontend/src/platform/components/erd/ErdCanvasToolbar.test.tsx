import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ErdCanvasToolbar } from "./ErdCanvasToolbar";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        "platform.erdDiagram": "Entity-relationship diagram",
        "platform.erdZoomIn": "Zoom In",
        "platform.erdZoomOut": "Zoom Out",
        "platform.erdResetZoom": "Reset Zoom",
        "platform.erdFullscreen": "Fullscreen",
        "platform.erdExitFullscreen": "Exit Fullscreen",
        "platform.erdCopySource": "Copy Mermaid",
        "platform.erdCopied": "Copied",
        "platform.erdDownloadSvg": "Download SVG",
      };
      return map[key] ?? key;
    },
  }),
}));

describe("ErdCanvasToolbar", () => {
  it("renders zoom percentage and toolbar controls correctly", () => {
    const html = renderToStaticMarkup(
      <ErdCanvasToolbar
        zoom={1.25}
        onZoomIn={vi.fn()}
        onZoomOut={vi.fn()}
        onResetZoom={vi.fn()}
        isFullscreen={false}
        onToggleFullscreen={vi.fn()}
        onCopySource={vi.fn()}
        copied={false}
        onDownloadSvg={vi.fn()}
        canDownload={true}
      />,
    );

    expect(html).toContain("125%");
    expect(html).toContain('role="toolbar"');
    expect(html).toContain('title="Zoom In"');
    expect(html).toContain('title="Zoom Out"');
    expect(html).toContain('title="Reset Zoom"');
    expect(html).toContain('title="Copy Mermaid"');
    expect(html).toContain('title="Download SVG"');
    expect(html).toContain('title="Fullscreen"');
  });

  it("renders active state for copied and fullscreen states", () => {
    const html = renderToStaticMarkup(
      <ErdCanvasToolbar
        zoom={1.0}
        onZoomIn={vi.fn()}
        onZoomOut={vi.fn()}
        onResetZoom={vi.fn()}
        isFullscreen={true}
        onToggleFullscreen={vi.fn()}
        onCopySource={vi.fn()}
        copied={true}
        onDownloadSvg={vi.fn()}
        canDownload={false}
      />,
    );

    expect(html).toContain("100%");
    expect(html).toContain("Copied");
    expect(html).toContain('title="Exit Fullscreen"');
  });
});
