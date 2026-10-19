import { EntityMessagingActions } from "@/components/app/EntityMessagingActions";
import { SectionLabel } from "@/components/app/SectionLabel";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";

export interface GuardianContactCardProps {
  label: string;
  badgeCode: string;
  /** Full semantic badge recipe (SEMANTIC_BADGE) — SSOT for tile + label tone. */
  badgeTone: string;
  name: string;
  phone?: string;
  email?: string;
  onWhatsApp?: () => void;
  onSms?: () => void;
  onEmail?: () => void;
}

export function GuardianContactCard({
  label,
  badgeCode,
  badgeTone,
  name,
  phone,
  email,
  onWhatsApp,
  onSms,
  onEmail,
}: GuardianContactCardProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        "p-3 flex flex-wrap items-center justify-between gap-2 transition-colors hover:bg-muted/30",
      )}
    >
      <div className="flex min-w-0 items-center gap-3 text-start">
        <div
          className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0",
            badgeTone,
          )}
        >
          {badgeCode}
        </div>
        <div className="min-w-0">
          <SectionLabel toneClassName={badgeTone} className="mb-0.5 block bg-transparent border-0">
            {label}
          </SectionLabel>
          <h5 title={name} className="text-xs font-bold text-foreground truncate">{name}</h5>
          {(phone || email) && (
            <p title={phone || email} className="text-xs text-muted-foreground mt-0.5 truncate">{phone || email}</p>
          )}
        </div>
      </div>
      {phone || email ? (
        <EntityMessagingActions
          variant="icon-row"
          primaryPhone={phone}
          primaryEmail={email}
          labels={{
            call: t("students.detail.call"),
            whatsapp: t("students.list.actionWhatsApp"),
            sms: t("students.list.actionSms"),
            email: t("students.list.actionEmail"),
          }}
          callAriaLabel={phone ? t("students.detail.callPhone", { phone }) : undefined}
          whatsappAriaLabel={t("students.list.actionWhatsApp")}
          smsAriaLabel={t("students.list.actionSms")}
          emailAriaLabel={t("students.list.actionEmail")}
          onWhatsApp={onWhatsApp}
          onSms={onSms}
          onEmail={onEmail}
          className="shrink-0 me-1"
        />
      ) : null}
    </div>
  );
}
