import React from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock,
  GraduationCap,
  Send,
} from "lucide-react";
import { formatDate } from "@mms/contracts";
import { AuthPageFrame } from "@/components/entry";
import { Button } from "@mms/ui";
import { Card } from "@mms/ui";
import { EmptyState } from "@mms/ui";
import { ErrorState } from "@mms/fe-core/components/ErrorState";
import { Alert } from "@mms/ui";
import RouteStatusFallback from "@/components/routing/RouteStatusFallback";
import { useTranslation } from "@mms/fe-core/i18n";
import { useTenant } from "@mms/fe-core/tenant";
import { ROUTES } from "@mms/fe-core/config/routes";
import { publicRegistrationQueryOptions } from "@/lib/query/registrationQueries";
import { AdmissionsBrandHeader } from "./AdmissionsBrandHeader";
import { RegistrationFormFields } from "./RegistrationFormFields";
import { useRegistrationForm } from "./useRegistrationForm";

/** Public application form at `/apply/:slug` (no sign-in). */
export default function RegistrationFormPage(): React.JSX.Element {
  const { t } = useTranslation();
  const { slug = "" } = useParams();
  const { workspace, publicBranding } = useTenant();
  const query = useQuery(publicRegistrationQueryOptions(slug));
  const form = useRegistrationForm(slug, query.data);
  const view = query.data;

  if (query.isPending) return <RouteStatusFallback fullScreen />;

  const effectiveMadrasaName =
    view?.madrasaName || workspace?.madrasaName || publicBranding?.madrasaName || "";
  const effectiveLogoUrl = view?.logoUrl ?? publicBranding?.logoUrl ?? null;

  const sessionDates = view
    ? [view.startDate && formatDate(view.startDate), view.endDate && formatDate(view.endDate)]
        .filter(Boolean)
        .join(" – ")
    : "";

  return (
    <AuthPageFrame>
      <div className="relative z-elevated w-full max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6 sm:space-y-8">
        <AdmissionsBrandHeader logoUrl={effectiveLogoUrl} institutionName={effectiveMadrasaName} />

        <Card className="relative overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm p-6 sm:p-8 space-y-6">
          {/* Top brand accent line */}
          <div className="h-1.5 w-full bg-primary -mx-6 -mt-6 sm:-mx-8 sm:-mt-8 mb-6" aria-hidden />

          {query.isError || !view ? (
            <ErrorState
              title={t("apply.notFoundTitle")}
              description={t("apply.notFoundDescription")}
            />
          ) : form.outcome.kind === "success" ? (
            <section role="status" aria-live="polite" className="space-y-4 text-center py-6">
              <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-success/10 border border-success/30 shadow-xs">
                <CheckCircle2 className="size-8 text-success" aria-hidden />
              </div>
              <div className="space-y-1.5">
                <h1 className="text-balance text-xl sm:text-2xl font-bold text-foreground">
                  {t("apply.successTitle")}
                </h1>
                <p className="text-pretty text-sm text-muted-foreground max-w-md mx-auto">
                  {t(
                    form.outcome.status === "waitlisted"
                      ? "apply.successWaitlisted"
                      : form.outcome.status === "approved"
                        ? "apply.successApproved"
                        : "apply.successSubmitted",
                  )}
                </p>
              </div>
              <div className="inline-flex flex-col items-center gap-1 rounded-xl border border-border/70 bg-muted/40 px-6 py-3">
                <span className="text-3xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {t("apply.keepReference")}
                </span>
                <span className="font-mono text-lg font-bold text-foreground" dir="ltr">
                  {form.outcome.reference}
                </span>
              </div>
            </section>
          ) : (
            <>
              {/* Branded Card Header */}
              <header className="rounded-xl border border-border/60 bg-muted/20 p-4 sm:p-5 space-y-3">
                <div className="flex items-center gap-3">
                  {effectiveLogoUrl ? (
                    <img
                      src={effectiveLogoUrl}
                      alt={effectiveMadrasaName}
                      className="size-11 sm:size-12 rounded-xl object-contain p-1 bg-card border border-border/50 shadow-xs shrink-0"
                    />
                  ) : (
                    <div
                      data-testid="form-brand-monogram"
                      className="size-11 sm:size-12 rounded-xl bg-primary/10 border border-primary/20 shadow-xs flex items-center justify-center font-bold text-xs text-primary shrink-0 select-none"
                      aria-label={effectiveMadrasaName || "Institution monogram"}
                    >
                      <GraduationCap className="size-5 text-primary" aria-hidden />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">
                      {effectiveMadrasaName}
                    </p>
                    <h1 className="text-lg sm:text-xl font-bold text-foreground text-balance leading-snug">
                      {view.title}
                    </h1>
                  </div>
                </div>

                {/* Clean date/deadline pills */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/40">
                  {sessionDates && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-2.5 py-1 text-xs font-medium text-foreground border border-border/60">
                      <CalendarDays className="size-3.5 text-primary" aria-hidden />
                      <span>{sessionDates}</span>
                    </span>
                  )}
                  {view.closesAt && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning border border-warning/30">
                      <Clock className="size-3.5" aria-hidden />
                      <span>{t("apply.closesOn", { date: formatDate(view.closesAt) })}</span>
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success border border-success/30">
                    <span className="size-1.5 rounded-full bg-success animate-pulse" aria-hidden />
                    <span>
                      {view.acceptingSubmissions ? t("apply.statusOpen") : t("apply.waitlistOnly")}
                    </span>
                  </span>
                </div>
              </header>

              {!view.acceptingSubmissions ? (
                <EmptyState
                  icon={ClipboardList}
                  title={t("apply.closedTitle")}
                  description={t("apply.closedDescription")}
                />
              ) : (
                <form
                  className="space-y-6"
                  noValidate
                  onSubmit={(event) => {
                    event.preventDefault();
                    void form.submit();
                  }}
                >
                  <RegistrationFormFields
                    view={view}
                    draft={form.draft}
                    update={form.update}
                    disabled={form.isPending}
                    errors={form.errors}
                  />

                  {form.eligibility && !form.eligibility.eligible ? (
                    <Alert
                      role="alert"
                      title={t("apply.notEligible")}
                      description={form.eligibility.reasons
                        .map((reason) => t(`apply.reasons.${reason}`))
                        .join(" ")}
                    />
                  ) : form.eligibility?.eligible && form.seatsLeft === 0 ? (
                    <Alert tone="info" title={t("apply.waitlistNotice")} />
                  ) : null}

                  {form.outcome.kind === "error" ? (
                    <Alert
                      tone="destructive"
                      role="alert"
                      title={t("apply.submitFailed")}
                      description={
                        form.outcome.reasons.length > 0
                          ? form.outcome.reasons
                              .map((reason) => t(`apply.reasons.${reason}`))
                              .join(" ")
                          : form.outcome.type === "rate_limit_exceeded"
                            ? t("apply.tooManyAttempts")
                            : form.outcome.message
                      }
                    />
                  ) : null}

                  <Button
                    type="submit"
                    className="min-h-11 w-full sm:w-auto px-6 font-semibold shadow-xs"
                    disabled={!form.canSubmit || form.isPending}
                  >
                    <Send className="size-4 rtl:rotate-180" aria-hidden />
                    <span>{form.isPending ? t("apply.submitting") : t("apply.submit")}</span>
                  </Button>
                </form>
              )}
            </>
          )}

          {/* Navigation back link */}
          <div className="pt-2 text-center">
            <Link
              to={ROUTES.apply}
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
              <span>{t("apply.backToAll")}</span>
            </Link>
          </div>
        </Card>
      </div>
    </AuthPageFrame>
  );
}
