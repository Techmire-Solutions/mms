import React from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ClipboardList, Send } from "lucide-react";
import { formatDate } from "@mms/shared";
import { AuthPageFrame } from "@/components/entry";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { WarningCallout } from "@/components/ui/WarningCallout";
import RouteStatusFallback from "@/components/routing/RouteStatusFallback";
import { useTranslation } from "@/hooks/useTranslation";
import { ROUTES } from "@/lib/config/routes";
import { publicRegistrationQueryOptions } from "@/lib/query/registrationQueries";
import { RegistrationFormFields } from "./RegistrationFormFields";
import { useRegistrationForm } from "./useRegistrationForm";

/** Public application form at `/apply/:slug` (no sign-in). */
export default function RegistrationFormPage(): React.JSX.Element {
  const { t } = useTranslation();
  const { slug = "" } = useParams();
  const query = useQuery(publicRegistrationQueryOptions(slug));
  const form = useRegistrationForm(slug, query.data);
  const view = query.data;

  if (query.isPending) return <RouteStatusFallback fullScreen />;

  return (
    <AuthPageFrame>
      <Card className="relative z-elevated w-full max-w-2xl space-y-5 p-5 sm:p-6">
        {query.isError || !view ? (
          <ErrorState title={t("apply.notFoundTitle")} description={t("apply.notFoundDescription")} />
        ) : form.outcome.kind === "success" ? (
          <section role="status" aria-live="polite" className="space-y-3 text-center">
            <CheckCircle2 className="mx-auto size-10 text-success" aria-hidden />
            <h1 className="text-balance text-xl font-semibold">{t("apply.successTitle")}</h1>
            <p className="text-pretty text-sm text-muted-foreground">
              {t(form.outcome.status === "waitlisted" ? "apply.successWaitlisted" : form.outcome.status === "approved" ? "apply.successApproved" : "apply.successSubmitted")}
            </p>
            <p className="font-mono text-lg" dir="ltr">{form.outcome.reference}</p>
            <p className="text-xs text-muted-foreground">{t("apply.keepReference")}</p>
          </section>
        ) : (
          <>
            <header className="space-y-1">
              <p className="text-sm text-muted-foreground">{view.madrasaName}</p>
              <h1 className="text-balance text-xl font-semibold">{view.title}</h1>
              <p className="text-sm text-muted-foreground">
                {[view.startDate && formatDate(view.startDate), view.endDate && formatDate(view.endDate)].filter(Boolean).join(" – ")}
                {view.closesAt ? ` · ${t("apply.closesOn", { date: formatDate(view.closesAt) })}` : ""}
              </p>
            </header>
            {!view.acceptingSubmissions ? (
              <EmptyState icon={ClipboardList} title={t("apply.closedTitle")} description={t("apply.closedDescription")} />
            ) : (
              <form className="space-y-4" noValidate onSubmit={(event) => { event.preventDefault(); void form.submit(); }}>
                <RegistrationFormFields view={view} draft={form.draft} update={form.update} disabled={form.isPending} />
                {form.eligibility && !form.eligibility.eligible ? (
                  <WarningCallout role="alert" title={t("apply.notEligible")}
                    description={form.eligibility.reasons.map((reason) => t(`apply.reasons.${reason}`)).join(" ")} />
                ) : form.eligibility?.eligible && form.seatsLeft === 0 ? (
                  <WarningCallout tone="info" title={t("apply.waitlistNotice")} />
                ) : null}
                {form.outcome.kind === "error" ? (
                  <WarningCallout tone="destructive" role="alert" title={t("apply.submitFailed")}
                    description={form.outcome.reasons.length > 0
                      ? form.outcome.reasons.map((reason) => t(`apply.reasons.${reason}`)).join(" ")
                      : form.outcome.type === "rate_limit_exceeded" ? t("apply.tooManyAttempts") : form.outcome.message} />
                ) : null}
                <Button type="submit" className="min-h-11 w-full sm:w-auto" disabled={!form.canSubmit}>
                  <Send className="size-4 rtl:rotate-180" aria-hidden />
                  {form.isPending ? t("apply.submitting") : t("apply.submit")}
                </Button>
              </form>
            )}
          </>
        )}
        <p className="text-center text-xs">
          <Link className="text-primary underline-offset-4 hover:underline" to={ROUTES.apply}>{t("apply.allOpenSessions")}</Link>
        </p>
      </Card>
    </AuthPageFrame>
  );
}
