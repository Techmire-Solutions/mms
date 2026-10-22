import React from "react";
import { Briefcase, Building2, MapPin, Calendar } from "lucide-react";
import type { Contact } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { DetailSectionCard } from "@/components/app/DetailSectionCard";
import { Badge } from "@/components/ui/badge";
import { COLLECTION_CONTAINER_CLASS } from "./contactDetailStyles";
import { CopyButton } from "@/components/app/CopyButton";
import {
  MESSAGING_ICON_BTN,
  MESSAGING_ICON_BTN_TONES,
} from "@/components/app/messagingActionStyles";
import { cn } from "@/lib/utils";

export interface ContactDetailExperienceSectionProps {
  contact: Contact;
}

export function ContactDetailExperienceSection({
  contact,
}: ContactDetailExperienceSectionProps): React.JSX.Element {
  const { t } = useTranslation();
  const experienceList = contact.experience ?? [];

  if (experienceList.length === 0) {
    return (
      <DetailSectionCard
        className={COLLECTION_CONTAINER_CLASS}
        title={t("contacts.detail.experience")}
      >
        <div className="p-3 text-xs text-muted-foreground italic">
          {t("contacts.detail.emptyExperience")}
        </div>
      </DetailSectionCard>
    );
  }

  return (
    <DetailSectionCard
      className={COLLECTION_CONTAINER_CLASS}
      title={t("contacts.detail.experience")}
    >
      {experienceList.map((exp, idx) => {
        const period = [exp.startDate, exp.isCurrent ? t("contacts.form.present") : exp.endDate]
          .filter(Boolean)
          .join(" – ");

        const copyText = [
          exp.title,
          exp.organization,
          exp.employmentType,
          exp.location,
          period,
          exp.description,
        ]
          .filter(Boolean)
          .join(" - ");

        return (
          <div
            key={exp.id || `exp-${idx}`}
            className="p-3 border-b border-border/50 last:border-b-0 flex items-start justify-between gap-3"
          >
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-semibold text-xs text-foreground flex items-center gap-1.5 leading-relaxed">
                  <Briefcase className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="truncate">{exp.title}</span>
                </span>
                {exp.employmentType ? (
                  <Badge tone="primary" size="sm" className="font-medium text-3xs">
                    {exp.employmentType}
                  </Badge>
                ) : null}
                {exp.isCurrent ? (
                  <Badge
                    tone="success"
                    size="sm"
                    className="text-2xs font-semibold uppercase tracking-wider"
                  >
                    {t("contacts.form.present")}
                  </Badge>
                ) : null}
              </div>

              <div className="text-xs text-foreground/90 flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate">{exp.organization}</span>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                {exp.location ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="truncate">{exp.location}</span>
                  </span>
                ) : null}
                {period ? (
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3 shrink-0" />
                    <span>{period}</span>
                  </span>
                ) : null}
              </div>

              {exp.description ? (
                <div className="text-xs text-muted-foreground whitespace-pre-line pt-0.5 leading-relaxed">
                  {exp.description}
                </div>
              ) : null}
            </div>

            {copyText ? (
              <div className="flex flex-shrink-0 items-center">
                <CopyButton
                  text={copyText}
                  showToast
                  className={cn(
                    MESSAGING_ICON_BTN,
                    MESSAGING_ICON_BTN_TONES.copy,
                    "flex items-center justify-center opacity-100",
                  )}
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </DetailSectionCard>
  );
}
