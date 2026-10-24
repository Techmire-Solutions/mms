import React from "react";
import { Award, Building2, Clock, CheckCircle2, Sparkles } from "lucide-react";
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

export interface ContactDetailSkillsSectionProps {
  contact: Contact;
}

export function ContactDetailSkillsSection({
  contact,
}: ContactDetailSkillsSectionProps): React.JSX.Element {
  const { t } = useTranslation();
  const skillsList = contact.skills ?? [];

  if (skillsList.length === 0) {
    return (
      <DetailSectionCard className={COLLECTION_CONTAINER_CLASS} title={t("contacts.detail.skills")}>
        <div className="p-3 text-xs text-muted-foreground italic">
          {t("contacts.detail.emptySkills")}
        </div>
      </DetailSectionCard>
    );
  }

  return (
    <DetailSectionCard className={COLLECTION_CONTAINER_CLASS} title={t("contacts.detail.skills")}>
      {skillsList.map((skill, idx) => {
        const copyText = [
          skill.name,
          skill.category,
          skill.proficiency,
          skill.yearsOfExperience,
          skill.isCertified ? t("contacts.fields.skillIsCertified") : null,
          skill.issuer,
          skill.description,
        ]
          .filter(Boolean)
          .join(" - ");

        return (
          <div
            key={skill.id || `skill-${idx}`}
            className="p-3 border-b border-border/50 last:border-b-0 flex items-start justify-between gap-3"
          >
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-semibold text-xs text-foreground flex items-center gap-1.5 leading-relaxed">
                  <Award className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="truncate">{skill.name}</span>
                </span>
                {skill.category ? (
                  <Badge tone="primary" size="sm" className="font-medium text-3xs">
                    {skill.category}
                  </Badge>
                ) : null}
                {skill.proficiency ? (
                  <Badge tone="warning" size="sm" className="font-medium text-3xs gap-1">
                    <Sparkles className="h-2.5 w-2.5 shrink-0" />
                    <span>{skill.proficiency}</span>
                  </Badge>
                ) : null}
                {skill.isCertified ? (
                  <Badge
                    tone="success"
                    size="sm"
                    className="text-2xs font-semibold uppercase tracking-wider gap-1"
                  >
                    <CheckCircle2 className="h-2.5 w-2.5 shrink-0" />
                    <span>{t("contacts.fields.skillIsCertified")}</span>
                  </Badge>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                {skill.issuer ? (
                  <span className="inline-flex items-center gap-1">
                    <Building2 className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <span className="truncate">{skill.issuer}</span>
                  </span>
                ) : null}
                {skill.yearsOfExperience ? (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <span>{skill.yearsOfExperience}</span>
                  </span>
                ) : null}
              </div>

              {skill.description ? (
                <div className="text-xs text-muted-foreground whitespace-pre-line pt-0.5 leading-relaxed">
                  {skill.description}
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
