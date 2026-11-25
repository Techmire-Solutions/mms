import React from "react";
import { BrainCircuit } from "lucide-react";
import { type Contact, getDisplayName } from "@mms/contracts";
import { useTranslation } from "@mms/fe-core/i18n";
import { ContactIdentityMeta } from "../ContactIdentityMeta";
import { ContactTagList } from "../ContactTagBadge";
import { PersonDetailHeroCard } from "@mms/fe-core/components/PersonDetailHeroCard";
import { DetailNotesBlock } from "@mms/ui/app/DetailNotesBlock";
import { BiDiText } from "@mms/ui/app/BiDiText";
import { Card } from "@mms/ui";
import { getGenderCardAccent } from "@mms/ui/app/genderUi";

export interface ContactDetailHeroCardProps {
  contact: Contact;
}

export function ContactDetailHeroCard({ contact }: ContactDetailHeroCardProps): React.JSX.Element {
  const { t } = useTranslation();
  // `notes`/`aiSummary` are intentionally NOT gated by field config: `notes` is a
  // retired form field (`REMOVED_FORM_FIELD_KEYS`), so it never appears in the
  // tenant field registry and thus has no `isTabFieldEnabled`/`canViewContactField`
  // entry. The hero card renders them as fixed chrome; role-hidden values are
  // already stripped by the authoritative backend `contactResponseSanitizer`.
  const aiSummary = typeof contact.aiSummary === "string" ? contact.aiSummary.trim() : "";
  const notes = typeof contact.notes === "string" ? contact.notes.trim() : "";

  return (
    <>
      <PersonDetailHeroCard
        id={contact.id}
        displayName={getDisplayName(contact)}
        avatar={contact.avatar}
        gender={contact.gender}
        accentColor={getGenderCardAccent(contact.gender)}
      >
        <ContactIdentityMeta gender={contact.gender} isSyed={contact.isSyed} size="md" />
        <ContactTagList contact={contact} size="sm" className="mt-1.5 gap-1.5" />
      </PersonDetailHeroCard>

      {aiSummary ? (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-primary">
            <BrainCircuit className="w-3.5 h-3.5" aria-hidden />
            <span className="text-xs font-bold uppercase tracking-widest">
              {t("contacts.detail.aiIntelligence")}
            </span>
          </div>
          <Card className="p-4 rounded-2xl bg-primary/5 border border-primary/20 shadow-none text-sm text-foreground leading-relaxed italic relative break-words text-pretty">
            <BiDiText>{aiSummary}</BiDiText>
          </Card>
        </div>
      ) : null}

      {notes ? <DetailNotesBlock title={t("contacts.columns.notes")} notes={notes} /> : null}
    </>
  );
}
