import React from "react";
import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/hooks/useTranslation";

export interface SequenceNumberingPreviewProps {
  livePreview: string;
  formulaTemplate: string;
  previewLabel?: string;
  templateLabel?: string;
}

export function SequenceNumberingPreview({
  livePreview,
  formulaTemplate,
  previewLabel,
  templateLabel,
}: SequenceNumberingPreviewProps): React.JSX.Element {
  const { t } = useTranslation();
  const preview = previewLabel ?? t("common.sequenceNumbering.preview");
  const template = templateLabel ?? t("common.sequenceNumbering.template");

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-start shadow-2xs sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary motion-reduce:animate-none" aria-hidden />
          <span className="text-sm font-semibold text-foreground">{preview}</span>
        </div>
        <p className="font-mono text-xs text-muted-foreground">
          <span>{template}: </span>
          <span className="text-foreground/80">{formulaTemplate}</span>
        </p>
      </div>

      <Badge
        variant="default"
        className="bg-primary px-3.5 py-1.5 font-mono text-base font-bold tracking-widest text-primary-foreground shadow-xs"
      >
        {livePreview}
      </Badge>
    </div>
  );
}
