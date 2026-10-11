import { ArrowUpRight } from "lucide-react";
import type { Contact } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { EntityMessagingActions } from "@/components/ui/EntityMessagingActions";
import { ContactCardMessagingButtons } from "@/tenant/features/contacts/components/ContactCardMessagingButtons";
import {
  MESSAGING_ICON_BTN,
  MESSAGING_ICON_BTN_TONES,
} from "@/components/ui/messagingActionStyles";
import { cn } from "@/lib/utils";
import { DETAIL_STYLES } from "./contactDetailStyles";

export interface ContactNetworkLinkCardProps {
  displayName: string;
  relationshipLabel: string;
  avatarId: string | number;
  avatar?: string | null;
  target?: Contact;
  targetPhone: string | null;
  targetEmail: string | null;
  legacyPhone: string;
  showTargetMessaging: boolean;
  showLegacyCall: boolean;
  canNavigate: boolean;
  linkedId?: string | number;
  onNavigateToContact: (targetId: string | number) => void;
  onWhatsApp?: (contacts: Contact[]) => void;
  onSms?: (contacts: Contact[]) => void;
  onEmail?: (contacts: Contact[]) => void;
}

export function ContactNetworkLinkCard({
  displayName,
  relationshipLabel,
  avatarId,
  avatar,
  target,
  targetPhone,
  targetEmail,
  legacyPhone,
  showTargetMessaging,
  showLegacyCall,
  canNavigate,
  linkedId,
  onNavigateToContact,
  onWhatsApp,
  onSms,
  onEmail,
}: ContactNetworkLinkCardProps): React.JSX.Element {
  const { t } = useTranslation();
  const resolvedName = displayName || t("contacts.detail.unknownContact");
  const hasActions = showTargetMessaging || showLegacyCall || canNavigate;
  const navigateLabel = displayName
    ? t("contacts.detail.viewContact", { name: displayName })
    : t("contacts.fields.linkedContact");

  return (
    <div
      className={cn(
        "flex flex-col gap-2.5 p-4 transition-colors hover:bg-muted/30",
        DETAIL_STYLES.networkItemCard,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <UserAvatar
          id={avatarId}
          name={resolvedName}
          avatar={avatar}
          gender={target?.gender}
          className="w-10 h-10 rounded-xl text-xs flex-shrink-0"
        />
        <div className="min-w-0 flex-1 space-y-1">
          <h5
            className="text-sm font-bold text-foreground leading-snug break-words"
            title={resolvedName}
          >
            {resolvedName}
          </h5>
          <SectionLabel as="p" weight="semibold" toneClassName={DETAIL_STYLES.networkRelType}>
            {relationshipLabel}
          </SectionLabel>
        </div>
      </div>

      {hasActions ? (
        <div className="flex flex-wrap items-center gap-1.5 ps-13">
          {showTargetMessaging && target ? (
            <ContactCardMessagingButtons
              contact={target}
              displayName={resolvedName}
              phone={targetPhone}
              email={targetEmail}
              showArchived={false}
              onWhatsApp={onWhatsApp}
              onSms={onSms}
              onEmail={onEmail}
            />
          ) : showLegacyCall ? (
            <EntityMessagingActions
              variant="icon-row"
              primaryPhone={legacyPhone}
              labels={{ call: t("contacts.detail.call") }}
              callAriaLabel={t("contacts.detail.callPhone", { phone: legacyPhone })}
              messagingEnabled={false}
              showCall
            />
          ) : null}

          {canNavigate && linkedId != null ? (
            <Button
              variant="outline"
              size="icon"
              aria-label={navigateLabel}
              title={navigateLabel}
              onClick={() => onNavigateToContact(linkedId)}
              className={cn(
                MESSAGING_ICON_BTN,
                MESSAGING_ICON_BTN_TONES.link,
                "flex items-center justify-center shadow-none",
                DETAIL_STYLES.networkItemAction,
              )}
              type="button"
            >
              <ArrowUpRight className="w-4 h-4" aria-hidden />
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
