import React, { type JSX } from "react";
import { ContactEmailAction, ContactPhoneAction } from "@/components/app/ContactAction";
import type {
  ContactResolvedPhone,
  ContactResolvedEmail,
} from "@/lib/contacts/contactPhoneDisplay";

export interface EntityCardInfoPillsProps {
  /** List of all resolved phones for multi-phone contacts. */
  phones?:
    | ContactResolvedPhone[]
    | Array<{
        number?: string;
        phone?: string;
        countryCode?: string;
        phoneDisplay?: string;
        label?: string;
      }>;
  /** List of all resolved emails for multi-email contacts. */
  emails?: ContactResolvedEmail[] | Array<{ address?: string; email?: string; label?: string }>;
  /** Scalar fallback phone string. */
  phone?: string | null;
  phoneDisplay?: string | null;
  countryCode?: string | null;
  /** Scalar fallback email string. */
  email?: string | null;
  displayName?: string;
  showPhone?: boolean;
  showEmail?: boolean;
  showArchived?: boolean;
  onWhatsApp?: (phone?: string) => void;
  onSms?: (phone?: string) => void;
  onCall?: (phone?: string) => void;
  onEmail?: (email?: string) => void;
}

/** Phone/email face pills stack for Work directory entity cards with inline contact actions (supports multiple channels). */
export const EntityCardInfoPills = function EntityCardInfoPills({
  phones: phonesProp,
  emails: emailsProp,
  phone,
  phoneDisplay,
  countryCode,
  email,
  displayName,
  showPhone = true,
  showEmail = true,
  showArchived = false,
  onWhatsApp,
  onSms,
  onCall,
  onEmail,
}: EntityCardInfoPillsProps): JSX.Element | null {
  const effectivePhones: Array<{
    phone: string;
    countryCode?: string;
    phoneDisplay?: string;
    label?: string;
  }> = (() => {
    if (Array.isArray(phonesProp) && phonesProp.length > 0) {
      return phonesProp
        .map((p) => {
          const rec = p as Record<string, unknown>;
          const rawPhone = String(rec.phone || rec.number || "").trim();
          const cc = typeof rec.countryCode === "string" ? rec.countryCode : undefined;
          const disp =
            typeof rec.phoneDisplay === "string" ? rec.phoneDisplay : rawPhone || undefined;
          const lbl = typeof rec.label === "string" ? rec.label : undefined;
          return {
            phone: rawPhone,
            countryCode: cc,
            phoneDisplay: disp,
            label: lbl,
          };
        })
        .filter((p) => Boolean(p.phone));
    }
    if (phone && phone.trim()) {
      return [
        {
          phone: phone.trim(),
          countryCode: countryCode || undefined,
          phoneDisplay: phoneDisplay || phone.trim(),
        },
      ];
    }
    return [];
  })();

  const effectiveEmails: Array<{ email: string; label?: string }> = (() => {
    if (Array.isArray(emailsProp) && emailsProp.length > 0) {
      return emailsProp
        .map((e) => {
          const rec = e as Record<string, unknown>;
          const rawEmail = String(rec.email || rec.address || "").trim();
          const lbl = typeof rec.label === "string" ? rec.label : undefined;
          return {
            email: rawEmail,
            label: lbl,
          };
        })
        .filter((e) => Boolean(e.email));
    }
    if (email && email.trim()) {
      return [{ email: email.trim() }];
    }
    return [];
  })();

  const showPhones = showPhone && effectivePhones.length > 0;
  const showEmails = showEmail && effectiveEmails.length > 0;
  if (!showPhones && !showEmails) return null;

  return (
    <div className="space-y-2 py-0.5">
      {showPhones
        ? effectivePhones.map((p, idx) => (
            <ContactPhoneAction
              key={`phone-${p.phone}-${idx}`}
              phone={p.phone}
              phoneDisplay={p.phoneDisplay}
              countryCode={p.countryCode}
              name={displayName}
              variant="pill"
              disabled={showArchived}
              onWhatsApp={onWhatsApp ? () => onWhatsApp(p.phone) : undefined}
              onSms={onSms ? () => onSms(p.phone) : undefined}
              onCall={onCall ? () => onCall(p.phone) : undefined}
            />
          ))
        : null}
      {showEmails
        ? effectiveEmails.map((e, idx) => (
            <ContactEmailAction
              key={`email-${e.email}-${idx}`}
              email={e.email}
              name={displayName}
              variant="pill"
              disabled={showArchived}
              onEmail={onEmail ? () => onEmail(e.email) : undefined}
            />
          ))
        : null}
    </div>
  );
};
