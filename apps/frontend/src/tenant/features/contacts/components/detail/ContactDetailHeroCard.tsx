import React from "react";
import { BrainCircuit } from "lucide-react";
import { type Contact, getDisplayName, getContactTags } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { ContactIdentityMeta } from "../ContactIdentityMeta";
import { PersonDetailHeroCard } from "@/components/ui/PersonDetailHeroCard";
import { DetailNotesBlock } from "@/components/ui/DetailNotesBlock";
import { Badge } from "@/components/ui/badge";
import { getGenderCardAccent } from "@/lib/genderUi";

export interface ContactDetailHeroCardProps {
  contact: Contact;
}

export function ContactDetailHeroCard({ contact }: ContactDetailHeroCardProps): React.JSX.Element {
  const { t } = useTranslation();
  const aiSummary = typeof contact.aiSummary === "string" ? contact.aiSummary.trim() : "";
  const notes = typeof contact.notes === "string" ? contact.notes.trim() : "";
  const contactTags = getContactTags(contact);

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
        {contactTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {contactTags.map((tag) => (
              <Badge key={tag} tone="primary" className="px-2 py-0.5 text-xs font-medium">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </PersonDetailHeroCard>

      {aiSummary ? (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-primary">
            <BrainCircuit className="w-3.5 h-3.5" aria-hidden />
            <span className="text-xs font-bold uppercase tracking-widest">
              {t("contacts.detail.aiIntelligence")}
            </span>
          </div>
          <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 text-sm text-foreground leading-relaxed italic relative break-words">
            {aiSummary}
          </div>
        </div>
      ) : null}

      {notes ? <DetailNotesBlock title={t("contacts.columns.notes")} notes={notes} /> : null}
    </>
  );
}
