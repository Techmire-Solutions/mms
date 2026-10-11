import React from "react";
import { GraduationCap, School, Calendar, Award } from "lucide-react";
import type { Contact } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { DetailSectionCard } from "@/components/ui/DetailSectionCard";
import { COLLECTION_CONTAINER_CLASS } from "./contactDetailStyles";
import { CopyButton } from "@/components/ui/CopyButton";
import {
  MESSAGING_ICON_BTN,
  MESSAGING_ICON_BTN_TONES,
} from "@/components/ui/messagingActionStyles";
import { cn } from "@/lib/utils";

export interface ContactDetailEducationSectionProps {
  contact: Contact;
}

export function ContactDetailEducationSection({
  contact,
}: ContactDetailEducationSectionProps): React.JSX.Element {
  const { t } = useTranslation();
  const educationList = contact.education ?? [];

  if (educationList.length === 0) {
    return (
      <DetailSectionCard
        className={COLLECTION_CONTAINER_CLASS}
        title={t("contacts.detail.education")}
      >
        <div className="p-3 text-xs text-muted-foreground italic">
          {t("contacts.detail.emptyEducation")}
        </div>
      </DetailSectionCard>
    );
  }

  return (
    <DetailSectionCard
      className={COLLECTION_CONTAINER_CLASS}
      title={t("contacts.detail.education")}
    >
      {educationList.map((edu, idx) => {
        const fullDetails = [
          edu.fieldOfStudy
            ? `${t("contacts.fields.educationFieldOfStudy")}: ${edu.fieldOfStudy}`
            : null,
          edu.year ? `${t("contacts.fields.educationYear")}: ${edu.year}` : null,
          edu.grade ? `${t("contacts.fields.educationGrade")}: ${edu.grade}` : null,
        ]
          .filter(Boolean)
          .join(" · ");

        const copyText = [edu.degree, edu.institution, fullDetails].filter(Boolean).join(" - ");

        return (
          <div
            key={edu.id || `edu-${idx}`}
            className="p-3 border-b border-border/50 last:border-b-0 flex items-start justify-between gap-3"
          >
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-1.5">
                {edu.degree ? (
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                    {edu.degree}
                  </span>
                ) : null}
                {edu.year ? (
                  <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {edu.year}
                  </span>
                ) : null}
                {edu.grade ? (
                  <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                    <Award className="h-3 w-3" />
                    {edu.grade}
                  </span>
                ) : null}
              </div>

              <div className="font-semibold text-xs text-foreground flex items-center gap-1.5 leading-relaxed">
                <School className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate">{edu.institution}</span>
              </div>

              {edu.fieldOfStudy ? (
                <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <GraduationCap className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate">{edu.fieldOfStudy}</span>
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
