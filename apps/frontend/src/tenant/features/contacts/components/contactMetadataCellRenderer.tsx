import React from "react";
import {
  formatCnic,
  getContactTags,
  isRelationshipWorkColumnKey,
  type Contact,
  type ContactPreferences,
} from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { ContactTagList } from "@/tenant/features/contacts/components/ContactTagBadge";
import { formatContactCellValue } from "@/lib/contacts/contactI18n";
import {
  renderSocialMetadata,
  renderRelationshipMetadata,
  renderEducationMetadata,
  renderExperienceMetadata,
  renderSkillsMetadata,
} from "@/tenant/features/contacts/components/contactMetadataCollections";
import {
  renderLunarDobMetadata,
  renderSolarDobMetadata,
} from "@/tenant/features/contacts/components/contactMetadataDates";
import {
  renderEducationSubField,
  renderExperienceSubField,
  renderSkillsSubField,
} from "@/tenant/features/contacts/components/contactMetadataSubFields";
import {
  renderAddressFieldMetadata,
  renderGenderMetadata,
  renderSyedMetadata,
  renderWhatsAppMetadata,
} from "@/tenant/features/contacts/components/contactMetadataIdentity";

export interface RenderContactMetadataCellValueArgs {
  colId: string;
  contact: Contact;
  prefs: Pick<ContactPreferences, "showDetailedSolarAge" | "showLunarDob" | "showDetailedLunarAge">;
  contactsMap: Map<string, Contact> | null;
  t: TranslationFunction;
  language?: string;
  renderDash: () => React.ReactNode;
  renderJoinedList: (items: (string | undefined | null)[], showTitle?: boolean) => React.ReactNode;
}

export function renderContactMetadataCellValue({
  colId,
  contact,
  prefs,
  contactsMap,
  t,
  language,
  renderDash,
  renderJoinedList,
}: RenderContactMetadataCellValueArgs): React.ReactNode {
  const showDetailedSolarAge = prefs.showDetailedSolarAge !== false;
  const showLunarDob = Boolean(prefs.showLunarDob);
  const showDetailedLunarAge = Boolean(prefs.showDetailedLunarAge);
  const effectiveLang = language || "en";

  switch (colId) {
    case "gender":
      return renderGenderMetadata({ contact, emptyNode: renderDash(), t });
    case "isSyed":
      return renderSyedMetadata({ contact, emptyNode: renderDash(), t });
    case "city":
    case "country":
    case "state":
    case "line1":
      return renderAddressFieldMetadata({
        contact,
        colId,
        emptyNode: renderDash(),
      });
    case "solarDob":
    case "dob":
      return renderSolarDobMetadata({
        dob: contact.dob,
        showDetailedSolarAge,
        language: effectiveLang,
        emptyNode: renderDash(),
      });
    case "lunarDob":
      return renderLunarDobMetadata({
        dob: contact.dob,
        showLunarDob,
        showDetailedLunarAge,
        language: effectiveLang,
        emptyNode: renderDash(),
      });
    case "whatsapp":
      return renderWhatsAppMetadata({ contact });
    case "socials":
    case "socials_platform":
    case "socials_url":
      return renderSocialMetadata({
        contact,
        emptyNode: renderDash(),
        t,
      });
    case "cnic": {
      if (!contact.cnic) return renderDash();
      return <span className="font-mono">{formatCnic(contact.cnic) || contact.cnic}</span>;
    }
    case "tag":
    case "tags": {
      const hasTags = getContactTags(contact).length > 0 || (contact.systemTags?.length ?? 0) > 0;
      if (!hasTags) return renderDash();
      return <ContactTagList contact={contact} className="gap-1" />;
    }
    case "notes": {
      if (!contact.notes) return renderDash();
      return (
        <span className="truncate max-w-50 block" title={contact.notes}>
          {contact.notes}
        </span>
      );
    }
    case "education":
      return renderEducationMetadata({
        contact,
        emptyNode: renderDash(),
      });
    case "experience":
      return renderExperienceMetadata({
        contact,
        emptyNode: renderDash(),
      });
    case "skills":
      return renderSkillsMetadata({
        contact,
        emptyNode: renderDash(),
      });
    default: {
      const eduSub = renderEducationSubField(colId, contact, renderJoinedList);
      if (eduSub !== null) return eduSub;

      const expSub = renderExperienceSubField(colId, contact, renderJoinedList);
      if (expSub !== null) return expSub;

      const skillSub = renderSkillsSubField({
        colId,
        contact,
        renderJoinedList,
        emptyNode: renderDash(),
        t,
      });
      if (skillSub !== null) return skillSub;

      if (isRelationshipWorkColumnKey(colId)) {
        return renderRelationshipMetadata({
          contact,
          contactsMap,
          emptyNode: renderDash(),
          renderJoinedList,
          t,
        });
      }
      const raw = contact[colId as keyof Contact];
      const formatted = formatContactCellValue(raw, t);
      return formatted ? <span>{formatted}</span> : renderDash();
    }
  }
}
