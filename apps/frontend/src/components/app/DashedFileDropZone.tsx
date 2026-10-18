import type { ChangeEvent, DragEvent, RefObject } from "react";
import type { LucideIcon } from "lucide-react";
import { FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface DashedFileDropZoneProps {
  isDragging: boolean;
  onDraggingChange: (dragging: boolean) => void;
  onFiles: (files: FileList | null) => void;
  title: string;
  description: string;
  /** Accessible name for the hidden file input and browse control. */
  inputAriaLabel: string;
  /** When set with inputId/inputName, renders a hidden file input inside the zone. */
  inputId?: string;
  inputName?: string;
  fileInputRef?: RefObject<HTMLInputElement | null>;
  onFileChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  /** Prefer when the file input lives outside this component (e.g. Apple VCF panel). */
  onOpenPicker?: () => void;
  accept?: string;
  multiple?: boolean;
  isUploading?: boolean;
  icon?: LucideIcon;
  /** When set, renders a primary browse button; otherwise the zone itself is the picker. */
  browseLabel?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Shared dashed upload dropzone for drawer attachments and sync VCF import.
 */
export function DashedFileDropZone({
  isDragging,
  onDraggingChange,
  onFiles,
  title,
  description,
  inputAriaLabel,
  inputId,
  inputName,
  fileInputRef,
  onFileChange,
  onOpenPicker,
  accept,
  multiple = false,
  isUploading = false,
  icon: Icon = FileText,
  browseLabel,
  disabled = false,
  className,
}: DashedFileDropZoneProps): React.JSX.Element {
  const openPicker = () => {
    if (disabled || isUploading) return;
    if (onOpenPicker) {
      onOpenPicker();
      return;
    }
    fileInputRef?.current?.click();
  };

  const handleDragOver = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (disabled || isUploading) return;
    onDraggingChange(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onDraggingChange(false);
  };

  const handleDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onDraggingChange(false);
    if (disabled || isUploading) return;
    onFiles(event.dataTransfer.files);
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (onFileChange) {
      onFileChange(event);
      return;
    }
    onFiles(event.target.files);
  };

  const draggingClass = isDragging
    ? "border-primary bg-primary/5"
    : "border-border bg-muted/20 hover:border-primary/40 hover:bg-primary/5";

  const iconNode = (
    <div
      className={cn(
        "flex items-center justify-center text-primary",
        browseLabel ? "h-12 w-12 rounded-2xl bg-primary/10" : "opacity-40",
      )}
    >
      {isUploading ? (
        <Loader2
          className={cn("animate-spin", browseLabel ? "h-6 w-6" : "h-7 w-7")}
          aria-hidden="true"
        />
      ) : (
        <Icon className={browseLabel ? "h-6 w-6" : "h-7 w-7"} aria-hidden="true" />
      )}
    </div>
  );

  const copy = (
    <div className="text-center">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  );

  const fileInput =
    inputId && inputName ? (
      <input
        id={inputId}
        name={inputName}
        type="file"
        ref={fileInputRef}
        onChange={handleInputChange}
        multiple={multiple}
        accept={accept}
        className="hidden"
        aria-label={inputAriaLabel}
        disabled={disabled || isUploading}
      />
    ) : null;

  if (browseLabel) {
    return (
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed p-8 text-center transition-all",
          isDragging && "scale-102 motion-reduce:scale-100",
          draggingClass,
          className,
        )}
      >
        {iconNode}
        {copy}
        {fileInput}
        <Button
          disabled={disabled || isUploading}
          onClick={openPicker}
          className="mt-2 min-h-11 rounded-xl bg-primary px-6 text-xs font-bold text-primary-foreground shadow-none transition-all hover:scale-105 active:scale-95 motion-reduce:transform-none"
          type="button"
          aria-label={inputAriaLabel}
        >
          {browseLabel}
        </Button>
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      disabled={disabled || isUploading}
      onClick={openPicker}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      aria-label={inputAriaLabel}
      className={cn(
        "h-auto w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-7 text-muted-foreground shadow-none transition-all",
        draggingClass,
        className,
      )}
    >
      {iconNode}
      {copy}
      {fileInput}
    </Button>
  );
}
