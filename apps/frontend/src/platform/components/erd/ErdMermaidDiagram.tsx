import React, { useEffect, useId, useState, useCallback } from "react";
import { buildErdMermaid, type ErdDomain } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { ErrorState } from "@/components/ui/ErrorState";
import { WORK_SURFACE } from "@/components/ui/formStyles";
import { cn } from "@/lib/utils";
import { ErdCanvasToolbar } from "@/platform/components/erd/ErdCanvasToolbar";

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
    setStatus("pending");
    setSvg("");

    void import("mermaid")
      .then(async ({ default: mermaid }) => {
        if (controller.signal.aborted) return;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "base",
          themeVariables: {
            fontFamily: "ui-sans-serif, system-ui, sans-serif",
            primaryColor: readThemeColor("--card", "#f8fafc"),
            primaryTextColor: readThemeColor("--foreground", "#0f172a"),
            primaryBorderColor: readThemeColor("--border", "#cbd5e1"),
            lineColor: readThemeColor("--primary", "#047857"),
            secondaryColor: readThemeColor("--muted", "#f1f5f9"),
            tertiaryColor: readThemeColor("--background", "#ffffff"),
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
  }, [domain.id, renderId, retryTick, source]);

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
