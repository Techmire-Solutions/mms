import React, { useState } from "react";
import { Check, ZoomIn, ZoomOut, RotateCw } from "lucide-react";
import { uploadCanvasImage } from "@/lib/imageUpload";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Modal } from "@/components/app/Modal";
import { useAvatarCropperCanvas } from "@/components/app/useAvatarCropperCanvas";

interface AvatarCropperProps {
  src: string;
  /** Uploaded image URL (S3 / CDN), never a raw data URL. */
  onCrop: (url: string) => void;
  onCancel: () => void;
}

export function AvatarCropper({ src, onCrop, onCancel }: AvatarCropperProps): React.JSX.Element {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const {
    canvasRef,
    scale,
    setScale,
    dragging,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onTouchStart,
    onTouchMove,
    resetTransform,
    rotateCounterClockwise,
    adjustScaleFromWheel,
    renderCroppedCanvas,
    previewSize,
  } = useAvatarCropperCanvas(src);

  const handleCrop = (): void => {
    if (saving) return;
    const out = renderCroppedCanvas();
    if (!out) return;

    setSaving(true);
    void uploadCanvasImage(out, "avatar")
      .then((url) => {
        onCrop(url);
      })
      .catch(() => {
        notify.error(t("account.photoUploadFailed"));
      })
      .finally(() => {
        setSaving(false);
      });
  };

  return (
    <Modal
      open={true}
      onClose={onCancel}
      title={t("contacts.form.cropProfilePhoto")}
      subtitle={t("contacts.form.cropperInstructions")}
      priority
      size="sm"
    >
      <div className="space-y-4">
        <div className="flex items-center justify-center bg-sidebar/90 py-6 rounded-xl overflow-hidden">
          <canvas
            ref={canvasRef}
            width={previewSize}
            height={previewSize}
            aria-label={t("contacts.form.cropProfilePhoto")}
            style={{
              width: previewSize,
              height: previewSize,
              cursor: dragging ? "grabbing" : "grab",
              borderRadius: "50%",
            }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onMouseUp}
            onWheel={(event) => {
              event.preventDefault();
              adjustScaleFromWheel(event.deltaY);
            }}
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <ZoomOut className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <Slider
              min={0.3}
              max={5}
              step={0.01}
              value={[scale]}
              onValueChange={(values) => setScale(values[0])}
              className="flex-1"
              aria-label={t("contacts.form.zoomScale")}
              disabled={saving}
            />
            <ZoomIn className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={rotateCounterClockwise}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 min-h-11 rounded-lg border border-border text-xs font-medium hover:bg-muted transition-colors text-foreground shadow-none"
            >
              <RotateCw className="w-3.5 h-3.5 -scale-x-100" />
              <span>{t("contacts.form.rotate")}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={resetTransform}
              disabled={saving}
              className="px-3 min-h-11 rounded-lg border border-border text-xs font-medium hover:bg-muted transition-colors text-muted-foreground shadow-none"
            >
              {t("contacts.form.reset")}
            </Button>
            <Button
              type="button"
              onClick={handleCrop}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-1.5 min-h-11 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shadow-none disabled:opacity-60"
            >
              <Check className="w-4 h-4" />
              <span>{saving ? t("common.loading") : t("contacts.form.applyPhoto")}</span>
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
