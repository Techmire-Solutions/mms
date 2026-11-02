import React from "react";
import { BrainCircuit } from "lucide-react";
import { type Contact, getDisplayName } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { ContactIdentityMeta } from "../ContactIdentityMeta";
import { ContactTagList } from "../ContactTagBadge";
import { PersonDetailHeroCard } from "@/components/app/PersonDetailHeroCard";
import { DetailNotesBlock } from "@/components/app/DetailNotesBlock";
import { Card } from "@/components/ui/card";
import { getGenderCardAccent } from "@/lib/ui/genderUi";

export interface ContactDetailHeroCardProps {
  contact: Contact;
}

export function ContactDetailHeroCard({ contact }: ContactDetailHeroCardProps): React.JSX.Element {
  const { t } = useTranslation();
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
          <Card className="p-4 rounded-2xl bg-primary/5 border-primary/20 shadow-none text-sm text-foreground leading-relaxed italic relative break-words">
            {aiSummary}
          </Card>
        </div>
      ) : null}

      {notes ? <DetailNotesBlock title={t("contacts.columns.notes")} notes={notes} /> : null}
    </>
  );
}
