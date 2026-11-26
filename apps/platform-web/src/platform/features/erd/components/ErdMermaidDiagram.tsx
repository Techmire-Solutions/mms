import React, { useEffect, useId, useState, useCallback } from "react";
import { buildErdMermaid, type ErdDomain } from "@mms/contracts";
import { useTranslation } from "@mms/fe-core/i18n";
import { ErrorState, WORK_SURFACE } from "@mms/ui";
import { cn } from "@/lib/utils";
import { ErdCanvasToolbar } from "@/platform/features/erd/components/ErdCanvasToolbar";

interface ErdMermaidDiagramProps {
  domain: ErdDomain;
}

type DiagramStatus = "pending" | "ready" | "error";

function readThemeColor(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!value) return fallback;
  if (
    value.startsWith("#") ||
    value.startsWith("rgb") ||
    value.startsWith("hsl") ||
    value.startsWith("oklch")
  ) {
    return value;
  }
  return `hsl(${value})`;
}

export function ErdMermaidDiagram({ domain }: ErdMermaidDiagramProps): React.JSX.Element {
  const { t } = useTranslation();
  const renderId = useId().replace(/:/g, "");
  const source = buildErdMermaid(domain);
  const [svg, setSvg] = useState("");
  const [status, setStatus] = useState<DiagramStatus>("pending");
  const [retryTick, setRetryTick] = useState(0);
  const [zoom, setZoom] = useState(1.0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);

  // A new diagram source or retry invalidates the rendered SVG — reset during render.
  const [prevRender, setPrevRender] = useState({
    source,
    domainId: domain.id,
    tableCount: domain.tables.length,
    retryTick,
  });
  if (
    prevRender.source !== source ||
    prevRender.domainId !== domain.id ||
    prevRender.tableCount !== domain.tables.length ||
    prevRender.retryTick !== retryTick
  ) {
    setPrevRender({ source, domainId: domain.id, tableCount: domain.tables.length, retryTick });
    setStatus("pending");
    setSvg("");
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

  useEffect(() => {
    if (typeof MutationObserver === "undefined") return;
    const observer = new MutationObserver(() => {
      setRetryTick((tick) => tick + 1);
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    void import("mermaid")
      .then(async ({ default: mermaid }) => {
        if (controller.signal.aborted) return;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "base",
          themeVariables: {
            fontFamily: "ui-sans-serif, system-ui, sans-serif",
            primaryColor: readThemeColor("--card", "hsl(210, 40%, 98%)"),
            primaryTextColor: readThemeColor("--foreground", "hsl(222, 47%, 11%)"),
            primaryBorderColor: readThemeColor("--border", "hsl(214, 32%, 91%)"),
            lineColor: readThemeColor("--primary", "hsl(163, 94%, 24%)"),
            secondaryColor: readThemeColor("--muted", "hsl(210, 40%, 96%)"),
            tertiaryColor: readThemeColor("--background", "hsl(0, 0%, 100%)"),
          },
        });
        const { svg: nextSvg } = await mermaid.render(
          `erd-${renderId}-${domain.id}-${domain.tables.length}`,
          source,
        );
        if (controller.signal.aborted) return;
        setSvg(nextSvg);
        setStatus("ready");
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus("error");
      });

    return () => {
      controller.abort();
    };
  }, [domain.id, domain.tables.length, renderId, retryTick, source]);

  const handleCopySource = useCallback(() => {
    void navigator.clipboard.writeText(source);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [source]);

  const handleDownloadSvg = useCallback(() => {
    if (!svg) return;
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${domain.id}-erd.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [domain.id, svg]);

  return (
    <figure
      className={cn(
        isFullscreen
          ? "fixed inset-0 z-50 bg-background/95 backdrop-blur-md p-6 flex flex-col overflow-hidden"
          : cn(WORK_SURFACE, "p-4 space-y-4"),
      )}
      aria-label={t("platform.erdDiagram")}
      aria-busy={status === "pending"}
    >
      <ErdCanvasToolbar
        zoom={zoom}
        onZoomIn={() => setZoom((z) => Math.min(2.0, Math.round((z + 0.25) * 100) / 100))}
        onZoomOut={() => setZoom((z) => Math.max(0.5, Math.round((z - 0.25) * 100) / 100))}
        onResetZoom={() => setZoom(1.0)}
        isFullscreen={isFullscreen}
        onToggleFullscreen={() => setIsFullscreen((prev) => !prev)}
        onCopySource={handleCopySource}
        copied={copied}
        onDownloadSvg={handleDownloadSvg}
        canDownload={status === "ready" && Boolean(svg)}
      />

      {status === "error" ? (
        <ErrorState
          compact
          title={t("platform.erdLoadFailed")}
          description={t("platform.erdLoadFailedHint")}
          onRetry={() => setRetryTick((tick) => tick + 1)}
        />
      ) : null}

      {status === "pending" ? (
        <p className="min-h-preview text-sm text-muted-foreground" aria-live="polite">
          {t("common.loading")}
        </p>
      ) : null}

      {status === "ready" ? (
        <div className="overflow-auto flex-1 min-h-80 rounded-xl border border-border/30 bg-muted/10 p-4">
          <div
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: "top center",
              transition: "transform 0.15s ease-out",
            }}
            className="[&_svg]:mx-auto [&_svg]:max-w-full [&_svg]:h-auto"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        </div>
      ) : null}
    </figure>
  );
}
