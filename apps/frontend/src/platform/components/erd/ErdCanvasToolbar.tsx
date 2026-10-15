import React from "react";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Minimize2,
  Copy,
  Check,
  Download,
} from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from "@shared/ui";

export interface ErdCanvasToolbarProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onCopySource: () => void;
  copied: boolean;
  onDownloadSvg: () => void;
  canDownload: boolean;
}

export function ErdCanvasToolbar({
  zoom,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  isFullscreen,
  onToggleFullscreen,
  onCopySource,
  copied,
  onDownloadSvg,
  canDownload,
}: ErdCanvasToolbarProps): React.JSX.Element {
  const { t } = useTranslation();
  const zoomPercent = Math.round(zoom * 100);

  return (
    <div
      role="toolbar"
      aria-label={t("platform.erdDiagram")}
      className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-3"
    >
      {/* Zoom controls */}
      <div className="flex items-center gap-1.5 bg-muted/40 p-1 rounded-xl border border-border/50">
        <Button
          variant="ghost"
          size="sm"
          icon={ZoomOut}
          onClick={onZoomOut}
          disabled={zoom <= 0.5}
          className="min-w-11 p-0 rounded-lg hover:bg-muted"
          title={t("platform.erdZoomOut")}
          aria-label={t("platform.erdZoomOut")}
        />

        <Button
          variant="ghost"
          size="sm"
          onClick={onResetZoom}
          className="px-2.5 text-xs font-mono font-bold text-foreground hover:bg-muted/80 rounded-lg transition-colors"
          title={t("platform.erdResetZoom")}
          aria-label={t("platform.erdResetZoom")}
        >
          {zoomPercent}%
        </Button>

        <Button
          variant="ghost"
          size="sm"
          icon={ZoomIn}
          onClick={onZoomIn}
          disabled={zoom >= 2.0}
          className="min-w-11 p-0 rounded-lg hover:bg-muted"
          title={t("platform.erdZoomIn")}
          aria-label={t("platform.erdZoomIn")}
        />

        <Button
          variant="ghost"
          size="sm"
          icon={RotateCcw}
          onClick={onResetZoom}
          className="min-w-11 p-0 rounded-lg hover:bg-muted text-muted-foreground"
          title={t("platform.erdResetZoom")}
          aria-label={t("platform.erdResetZoom")}
        />
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          icon={copied ? Check : Copy}
          onClick={onCopySource}
          title={copied ? t("platform.erdCopied") : t("platform.erdCopySource")}
          aria-label={copied ? t("platform.erdCopied") : t("platform.erdCopySource")}
          className={copied ? "text-success border-success/30" : undefined}
        >
          {copied ? t("platform.erdCopied") : t("platform.erdCopySource")}
        </Button>

        <Button
          variant="outline"
          size="sm"
          icon={Download}
          onClick={onDownloadSvg}
          disabled={!canDownload}
          title={t("platform.erdDownloadSvg")}
          aria-label={t("platform.erdDownloadSvg")}
        >
          {t("platform.erdDownloadSvg")}
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          icon={isFullscreen ? Minimize2 : Maximize2}
          onClick={onToggleFullscreen}
          className="min-w-11"
          title={isFullscreen ? t("platform.erdExitFullscreen") : t("platform.erdFullscreen")}
          aria-label={isFullscreen ? t("platform.erdExitFullscreen") : t("platform.erdFullscreen")}
        />
      </div>
    </div>
  );
}
