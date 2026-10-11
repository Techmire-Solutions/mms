import React from "react";
import { Mail, Phone } from "lucide-react";
import type { EmailAddress, PhoneNumber } from "@mms/shared";
import { EntityMessagingActions } from "@/components/ui/EntityMessagingActions";
import { useTranslation } from "@/hooks/useTranslation";

export interface StudentDetailContactChannelsProps {
  phones: PhoneNumber[];
  emails: EmailAddress[];
  canMessage?: boolean;
  hasOpenComposer?: boolean;
  onWhatsApp: (phoneNumber: string) => void;
  onSms: (phoneNumber: string) => void;
  onEmail: (emailAddress: string) => void;
}

export function StudentDetailContactChannels({
  phones,
  emails,
  canMessage = true,
  hasOpenComposer = false,
  onWhatsApp,
  onSms,
  onEmail,
}: StudentDetailContactChannelsProps): React.JSX.Element | null {
  const { t } = useTranslation();

  if (phones.length === 0 && emails.length === 0) return null;

  return (
    <>
      {phones.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-3xs font-semibold text-muted-foreground uppercase tracking-wider block">
            {t("students.detail.phonesLabel")}
          </span>
          {phones.map((phone, idx) => (
            <div
              key={`student-phone-${phone.number}-${idx}`}
              className="flex items-center justify-between gap-2 py-1 px-2.5 rounded-lg bg-muted/40 text-xs"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" aria-hidden />
                <span className="font-mono text-foreground truncate">{phone.number}</span>
                {phone.label && (
                  <span className="text-2xs text-muted-foreground font-medium uppercase tracking-tight">
                    {phone.label}
                  </span>
                )}
                {phone.isPrimary && (
                  <span className="text-2xs text-primary font-bold uppercase tracking-tight">
                    ★ {t("theme.tokenPrimary")}
                  </span>
                )}
              </div>
              {canMessage && (
                <EntityMessagingActions
                  variant="icon-row"
                  primaryPhone={phone.number}
                  labels={{
                    call: t("students.detail.call"),
                    whatsapp: t("students.list.actionWhatsApp"),
                    sms: t("students.list.actionSms"),
                  }}
                  callAriaLabel={t("students.detail.callPhone", { phone: phone.number })}
                  whatsappAriaLabel={t("students.list.actionWhatsApp")}
                  smsAriaLabel={t("students.list.actionSms")}
                  onWhatsApp={() => onWhatsApp(phone.number)}
                  onSms={() => onSms(phone.number)}
                  className="shrink-0"
                />
              )}
            </div>
          ))}
        </div>
      )}

      {emails.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-3xs font-semibold text-muted-foreground uppercase tracking-wider block">
            {t("students.detail.emailsLabel")}
          </span>
          {emails.map((email, idx) => (
            <div
              key={`student-email-${email.address}-${idx}`}
              className="flex items-center justify-between gap-2 py-1 px-2.5 rounded-lg bg-muted/40 text-xs"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" aria-hidden />
                <span className="text-foreground truncate">{email.address}</span>
                {email.label && (
                  <span className="text-2xs text-muted-foreground font-medium uppercase tracking-tight">
                    {email.label}
                  </span>
                )}
                {email.isPrimary && (
                  <span className="text-2xs text-primary font-bold uppercase tracking-tight">
                    ★ {t("theme.tokenPrimary")}
                  </span>
                )}
              </div>
              {canMessage && hasOpenComposer && (
                <EntityMessagingActions
                  variant="icon-row"
                  primaryEmail={email.address}
                  labels={{ email: t("students.list.actionEmail") }}
                  emailAriaLabel={t("students.list.actionEmail")}
                  onEmail={() => onEmail(email.address)}
                  className="shrink-0"
                />
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
