import { MapPin, type LucideIcon } from "lucide-react";
import { CollectionRowItem, type CollectionRowAction } from "./ContactDetailShared";
import { DetailSectionCard } from "@/components/ui/DetailSectionCard";
import { COLLECTION_CONTAINER_CLASS } from "./contactDetailStyles";
import { DetailCollectionEmpty } from "./contactDetailChannelHelpers";
import {
  MESSAGING_ICON_BTN,
  MESSAGING_ICON_BTN_TONES,
} from "@/components/ui/messagingActionStyles";
import { cn } from "@/lib/utils";

export interface ContactDetailExternalLinkRow {
  key: string;
  label: string;
  value: string;
  href?: string;
}

export interface ContactDetailExternalLinkSectionProps {
  title: string;
  emptyMessage: string;
  emptyDash: string;
  rows: ContactDetailExternalLinkRow[];
  actionIcon: LucideIcon;
  actionTitle: string;
}

/** Shared Addresses / Socials detail section: empty hint + external-link collection rows with outlined action buttons. */
export function ContactDetailExternalLinkSection({
  title,
  emptyMessage,
  emptyDash,
  rows,
  actionIcon,
  actionTitle,
}: ContactDetailExternalLinkSectionProps): React.JSX.Element {
  return (
    <DetailSectionCard className={COLLECTION_CONTAINER_CLASS} title={title}>
      {rows.length === 0 ? (
        <DetailCollectionEmpty title={emptyMessage} />
      ) : (
        rows.map((row) => {
          const tone =
            actionIcon === MapPin
              ? MESSAGING_ICON_BTN_TONES.location
              : MESSAGING_ICON_BTN_TONES.link;
          const actions: CollectionRowAction[] = row.href
            ? [
                {
                  key: "open",
                  title: actionTitle,
                  icon: actionIcon,
                  onClick: () => {
                    window.open(row.href, "_blank", "noopener,noreferrer");
                  },
                  className: cn(MESSAGING_ICON_BTN, tone),
                },
              ]
            : [];
          return (
            <CollectionRowItem
              key={row.key}
              label={row.label}
              value={row.value || emptyDash}
              actions={actions}
            />
          );
        })
      )}
    </DetailSectionCard>
  );
}
