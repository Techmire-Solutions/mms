import type React from "react";
import { Award, Briefcase, Calendar, GraduationCap } from "lucide-react";
import type { Contact } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { Badge } from "@/components/ui/badge";

export interface FacultyContactBackgroundSectionProps {
  contact: Contact;
}

export function FacultyContactBackgroundSection({
  contact,
}: FacultyContactBackgroundSectionProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const educations = contact.education ?? [];
  const skills = contact.skills ?? [];
  const experiences = contact.experience ?? [];

  const hasBackground = educations.length > 0 || skills.length > 0 || experiences.length > 0;
  if (!hasBackground) return null;

  return (
    <div className="space-y-3 pt-3 border-t border-border/40 text-start">
      {educations.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <GraduationCap className="w-3.5 h-3.5 text-primary" aria-hidden />
            <span>{t("contacts.detail.education")}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {educations.map((edu, idx) => {
              const details = [edu.fieldOfStudy, edu.year].filter(Boolean).join(" · ");
              return (
                <div
                  key={edu.id || `edu-${idx}`}
                  className="p-2 rounded-md bg-muted/40 border border-border/50 text-xs space-y-0.5"
                >
                  <div className="font-medium text-foreground flex items-center justify-between gap-1">
                    <span>{edu.degree || edu.institution}</span>
                    {edu.grade && (
                      <span className="text-4xs text-muted-foreground font-normal">
                        {edu.grade}
                      </span>
                    )}
                  </div>
                  {edu.degree && edu.institution && (
                    <div className="text-muted-foreground text-3xs">{edu.institution}</div>
                  )}
                  {details && <div className="text-muted-foreground text-3xs">{details}</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {skills.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Award className="w-3.5 h-3.5 text-primary" aria-hidden />
            <span>{t("contacts.detail.skills")}</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {skills.map((skill, idx) => (
              <Badge
                key={skill.id || `skill-${idx}`}
                variant="outline"
                className="bg-muted/40 text-xs font-normal gap-1"
              >
                <span>{skill.name}</span>
                {skill.proficiency && (
                  <span className="text-muted-foreground text-4xs">({skill.proficiency})</span>
                )}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {experiences.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Briefcase className="w-3.5 h-3.5 text-primary" aria-hidden />
            <span>{t("contacts.detail.experience")}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {experiences.map((exp, idx) => {
              const dates = [
                exp.startDate,
                exp.isCurrent ? t("contacts.form.present") : exp.endDate,
              ]
                .filter(Boolean)
                .join(" - ");
              return (
                <div
                  key={exp.id || `exp-${idx}`}
                  className="p-2 rounded-md bg-muted/40 border border-border/50 text-xs space-y-0.5"
                >
                  <div className="font-medium text-foreground">{exp.title}</div>
                  <div className="text-muted-foreground text-3xs">{exp.organization}</div>
                  {dates && (
                    <div className="text-muted-foreground text-3xs flex items-center gap-1">
                      <Calendar className="w-3 h-3" aria-hidden />
                      <span>{dates}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
