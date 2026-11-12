import { useTranslation } from "@/hooks/useTranslation";

export interface BlueprintSummary {
  selectedCount: number;
  totalMarks: number;
  deficits: Array<{ bucketIndex: number; requestedCount: number; selectedCount: number }>;
}

interface PaperBlueprintPreviewProps {
  preview: BlueprintSummary | null;
  result: BlueprintSummary | null;
}

/** Live preview (shared engine) and the authoritative server result after assembly. */
export function PaperBlueprintPreview({
  preview,
  result,
}: PaperBlueprintPreviewProps): React.JSX.Element {
  const { t } = useTranslation();

  const deficitList = (deficits: BlueprintSummary["deficits"]): React.JSX.Element => (
    <ul className="m-0 mt-1 list-disc ps-4">
      {deficits.map((deficit) => (
        <li key={deficit.bucketIndex}>
          {t("questionBank.blueprintDeficit", {
            index: String(deficit.bucketIndex + 1),
            requested: String(deficit.requestedCount),
            selected: String(deficit.selectedCount),
          })}
        </li>
      ))}
    </ul>
  );

  return (
    <>
      {preview && (
        <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
          <p className="m-0 font-semibold text-foreground">
            {t("questionBank.blueprintPreviewMarks", {
              count: String(preview.selectedCount),
              marks: String(preview.totalMarks),
            })}
          </p>
          <p className="m-0 mt-1">{t("questionBank.blueprintPreviewHint")}</p>
          {preview.deficits.length > 0 && deficitList(preview.deficits)}
        </div>
      )}

      {result && (
        <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          <p className="m-0 font-semibold text-foreground">
            {t("questionBank.blueprintResult", {
              count: result.selectedCount,
              marks: result.totalMarks,
            })}
          </p>
          {result.deficits.length === 0 ? (
            <p className="m-0">{t("questionBank.blueprintNoDeficit")}</p>
          ) : (
            deficitList(result.deficits)
          )}
        </div>
      )}
    </>
  );
}
