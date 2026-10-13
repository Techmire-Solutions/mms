import { DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { EntityMessagingActions } from "@/components/app/EntityMessagingActions";

export interface PersonMessagingRowActionsExtrasProps {
  /** Primary phone (or null when the row has none) — drives SMS visibility. */
  phone: string | null;
  /** Primary email (or null when the row has none) — drives email visibility. */
  email: string | null;
  /** Whether the phone is a WhatsApp number (E.164) — drives WhatsApp visibility. */
  hasWhatsApp: boolean;
  /** When true, omit messaging items (archived rows, face strips already covering channels). */
  hideMessagingItems?: boolean;
  onWhatsApp?: () => void;
  onSms?: () => void;
  onEmail?: () => void;
  /** Localized channel labels (translated by the module). */
  labels: {
    whatsapp: string;
    sms: string;
    email: string;
  };
}

/**
 * WhatsApp / SMS / Email trio for person-directory Work row/card action menus.
 *
 * Computes channel visibility from primary channels + optional handlers, renders
 * the separator + {@link EntityMessagingActions}, and returns null when no
 * channel is available — Contacts, Students, and Teachers pass only channels,
 * closures, and labels (no per-module `*Items` wrappers).
 */
export function PersonMessagingRowActionsExtras({
  phone,
  email,
  hasWhatsApp,
  hideMessagingItems = false,
  onWhatsApp,
  onSms,
  onEmail,
  labels,
}: PersonMessagingRowActionsExtrasProps): React.JSX.Element | null {
  const showWhatsApp = Boolean(onWhatsApp) && hasWhatsApp;
  const showSms = Boolean(onSms) && Boolean(phone);
  const showEmail = Boolean(onEmail) && Boolean(email);
  const showMessaging = !hideMessagingItems && (showWhatsApp || showSms || showEmail);

  if (!showMessaging) return null;

  return (
    <>
      <DropdownMenuSeparator />
      <EntityMessagingActions
        variant="dropdown"
        showWhatsApp={showWhatsApp}
        showSms={showSms}
        showEmail={showEmail}
        onWhatsApp={() => onWhatsApp?.()}
        onSms={() => onSms?.()}
        onEmail={() => onEmail?.()}
        labels={labels}
      />
    </>
  );
}
