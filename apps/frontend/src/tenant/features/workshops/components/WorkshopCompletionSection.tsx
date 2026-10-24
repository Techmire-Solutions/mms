import React from "react";
import { Award, Printer, RefreshCw } from "lucide-react";
import {
  todayISO,
  type WorkshopCompletionRow,
  type WorkshopCompletionShortfall,
  type WorkshopEvent,
} from "@mms/shared";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/app/ErrorState";
import { StatusBadge, type StatusBadgeConfigItem } from "@/components/app/StatusBadge";
import { SEMANTIC_BADGE } from "@/lib/ui/semanticTone";
import { printHtmlDocument } from "@/lib/ui/printHtmlDocument";
import { completionCertificateHtml } from "@/lib/ui/completionCertificateHtml";
import { useBrandPalette } from "@/lib/contexts/BrandingPaletteContext";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import {
  useEvaluateWorkshopCompletion,
  useIssueWorkshopCertificates,
  useWorkshopCompletion,
} from "../hooks/useWorkshopsCompletionApi";
import { formatWorkshopDates } from "./workshopsWorkColumns";

const SHORTFALL_KEYS = {
  attendance_none: "workshops.shortfall.attendanceNone",
  attendance_unknown: "workshops.shortfall.attendanceUnknown",
  attendance_below: "workshops.shortfall.attendanceBelow",
  score_missing: "workshops.shortfall.scoreMissing",
  score_below: "workshops.shortfall.scoreBelow",
} as const satisfies Record<WorkshopCompletionShortfall, string>;

const pct = (value: number | null) => (value === null ? "—" : `${value}%`);

export interface WorkshopCompletionSectionProps {
  workshop: WorkshopEvent;
  canWrite: boolean;
}

/** Completion standing, re-evaluation and participation certificates for one workshop. */
export function WorkshopCompletionSection({
  workshop,
  canWrite,
}: WorkshopCompletionSectionProps): React.JSX.Element {
  const { t } = useTranslation();
  const { primary } = useBrandPalette();
  const completion = useWorkshopCompletion(workshop.id);
  const evaluate = useEvaluateWorkshopCompletion();
  const issue = useIssueWorkshopCertificates();
  const editable = canWrite && !workshop.deletedAt;
  const rows = completion.data ?? [];
  // Only stored completions can be certified; the live rows show what an evaluation would store.
  const certifiable = rows.filter((row) => row.status === "completed" && row.completedAt);

  const statusConfig: Record<string, StatusBadgeConfigItem> = {
    completed: { label: t("workshops.completion.completed"), cls: SEMANTIC_BADGE.success },
    attended: { label: t("workshops.completion.attended"), cls: SEMANTIC_BADGE.warning },
    registered: { label: t("workshops.completion.registered"), cls: SEMANTIC_BADGE.muted },
  };

  const print = (targets: WorkshopCompletionRow[]) => {
    const html = targets
      .map((row) =>
        completionCertificateHtml({
          heading: t("workshops.certificate.heading"),
          statement: t("workshops.certificate.statement"),
          recipientName: row.contactName,
          courseName: workshop.title,
          period: formatWorkshopDates(workshop),
          issuedLabel: t("workshops.certificate.issuedOn"),
          issuedOn: row.certificateIssuedAt?.slice(0, 10) || todayISO(),
          accent: primary,
        }),
      )
      .join("");
    printHtmlDocument(t("workshops.certificate.heading"), html);
  };

  const issueAndPrint = async (targets: WorkshopCompletionRow[]) => {
    try {
      const pending = targets
        .filter((row) => !row.certificateIssuedAt)
        .map((row) => row.participantId);
      // An empty list means "every completed participant" to the API, so only send named ones.
      if (pending.length > 0) await issue.mutateAsync({ id: workshop.id, participantIds: pending });
      print(targets);
    } catch (err) {
      notify.error(err instanceof Error ? err.message : t("workshops.saveFailed"));
    }
  };

  const handleEvaluate = async () => {
    try {
      await evaluate.mutateAsync(workshop.id);
      notify.success(t("workshops.completion.evaluated"));
    } catch (err) {
      notify.error(err instanceof Error ? err.message : t("workshops.saveFailed"));
    }
  };

  return (
    <section aria-labelledby="workshop-completion-heading" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="workshop-completion-heading" className="text-sm font-semibold text-foreground">
          {t("workshops.completion.heading")}
        </h3>
        <div className="flex flex-wrap gap-2">
          {editable ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              icon={RefreshCw}
              className="min-h-11"
              disabled={evaluate.isPending || rows.length === 0}
              onClick={() => void handleEvaluate()}
            >
              {t("workshops.completion.evaluate")}
            </Button>
          ) : null}
          {editable && certifiable.length > 0 ? (
            <Button
              type="button"
              size="sm"
              icon={Award}
              className="min-h-11"
              disabled={issue.isPending}
              onClick={() => void issueAndPrint(certifiable)}
            >
              {t("workshops.certificate.issueAll")}
            </Button>
          ) : null}
        </div>
      </div>

      {completion.isError ? (
        <ErrorState
          title={t("workshops.loadFailed")}
          description={t("workshops.loadFailedHint")}
          onRetry={() => void completion.refetch()}
        />
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("workshops.noParticipants")}</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {rows.map((row) => (
            <li key={row.participantId} className="space-y-1 px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                  {row.contactName}
                </span>
                <StatusBadge status={row.status} config={statusConfig} size="sm" />
                {row.status === "completed" && row.completedAt ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-11"
                    aria-label={t("workshops.certificate.printNamed", { name: row.contactName })}
                    disabled={issue.isPending}
                    onClick={() => void (editable ? issueAndPrint([row]) : print([row]))}
                  >
                    <Printer className="size-4" aria-hidden="true" />
                  </Button>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground tabular-nums">
                {t("workshops.completion.facts", {
                  attendance: pct(row.attendancePct),
                  score: pct(row.scorePct),
                })}
                {row.certificateIssuedAt ? ` · ${t("workshops.certificate.issued")}` : ""}
              </p>
              {row.shortfalls.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {row.shortfalls.map((shortfall) => t(SHORTFALL_KEYS[shortfall])).join(" · ")}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
