import React, { useState, useRef } from "react";
import { ImageIcon, X, Loader2 } from "lucide-react";
import {
  IMAGE_UPLOAD_MAX_INPUT_BYTES,
  type ImageUploadPurpose,
  type LogoBrandColors,
} from "@mms/shared";
import { prepareImageForUpload } from "@/lib/imageOptimization";
import { useTranslation } from "@/hooks/useTranslation";
import { extractLogoBrandColors } from "@/lib/ui/extractLogoBrandColors";
import { uploadImageFile } from "@/lib/imageUpload";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FieldErrorMessage } from "@/components/app/FormField";
import { FieldHint } from "@/components/branding/BrandingFieldHint";

const MAX_FILE_BYTES = IMAGE_UPLOAD_MAX_INPUT_BYTES;

interface ImageUploadFieldProps {
  id: string;
  label: string;
  hint: string;
  value: string;
  onChange: (url: string) => void;
  onClear: () => void;
  /** When set, dominant logo colours are extracted after a successful upload. */
  onBrandColorsExtracted?: (colors: LogoBrandColors) => void;
  purpose?: ImageUploadPurpose;
  previewSize?: "logo" | "favicon";
}

export function ImageUploadField({
  id,
  label,
  hint,
  value,
  onChange,
  onClear,
  onBrandColorsExtracted,
  purpose,
  previewSize = "logo",
}: ImageUploadFieldProps): React.JSX.Element {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  const resolvedPurpose: ImageUploadPurpose =
    purpose ?? (previewSize === "favicon" ? "favicon" : "logo");

  const processFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError(t("branding.imageErrorType"));
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError(t("branding.imageErrorSize"));
      return;
    }

    setError(null);
    setUploading(true);
    try {
      const optimized = await prepareImageForUpload(file, resolvedPurpose);

      if (onBrandColorsExtracted) {
        const previewUrl = URL.createObjectURL(optimized);
        try {
          const colors = await extractLogoBrandColors(previewUrl);
          if (colors) onBrandColorsExtracted(colors);
        } finally {
          URL.revokeObjectURL(previewUrl);
        }
      }

      const url = await uploadImageFile(optimized, resolvedPurpose);
      onChange(url);
    } catch {
      setError(t("branding.imageErrorUpload"));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const previewClass = previewSize === "favicon" ? "h-14 w-14 rounded-lg" : "h-20 w-20 rounded-xl";

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div
        role="button"
        tabIndex={0}
        aria-labelledby={id}
        aria-describedby={error ? `${hintId} ${errorId}` : hintId}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) void processFile(file);
        }}
        onClick={() => !uploading && inputRef.current?.click()}
        className={cn(
          "flex items-center gap-4 rounded-xl border border-dashed p-4 transition-colors cursor-pointer",
          dragging
            ? "border-primary bg-primary/5"
            : "border-border bg-muted/20 hover:border-primary/40 hover:bg-muted/30",
          uploading && "pointer-events-none opacity-70",
        )}
      >
        <div
          className={cn(
            "relative flex shrink-0 items-center justify-center overflow-hidden border border-border bg-background",
            previewClass,
          )}
        >
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
          ) : value ? (
            <img src={value} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
          ) : (
            <ImageIcon className="h-5 w-5 text-muted-foreground" aria-hidden />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">
            {value ? t("branding.imageReplace") : t("branding.imageDropBrowse")}
          </p>
          <FieldHint id={hintId}>{hint}</FieldHint>
        </div>

        {value && !uploading && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0"
            aria-label={t("branding.imageRemoveAria", { label })}
            onClick={(event) => {
              event.stopPropagation();
              onClear();
              setError(null);
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        )}

        <input
          ref={inputRef}
          id={id}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/avif,image/svg+xml"
          className="sr-only"
          aria-label={label}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void processFile(file);
          }}
          disabled={uploading}
        />
      </div>
      {error && <FieldErrorMessage id={errorId} message={error} />}
    </div>
  );
}
