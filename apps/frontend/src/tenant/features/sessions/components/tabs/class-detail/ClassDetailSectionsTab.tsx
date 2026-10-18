import React, { useState } from "react";
import { Users } from "lucide-react";
import type { FacultyMember, SessionClassSection } from "@mms/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FormCollectionShell,
  FormListFieldCard,
  FormSelect,
} from "@/components/app/FormPrimitives";
import { useTranslation } from "@/hooks/useTranslation";
import { useAcademicTerms } from "@/hooks/useAcademicTerms";
import { SectionStaffModal } from "../SectionStaffModal";
import { useSessionStructureLock } from "../sessionStructureLock";

interface ClassDetailSectionsTabProps {
  classId: string;
  sections: SessionClassSection[];
  /** Sections already persisted (staff can only be managed for saved sections). */
  savedSectionIds: ReadonlySet<string>;
  allFaculty: FacultyMember[];
  onChange: (sections: SessionClassSection[]) => void;
}

function nextSectionName(sections: SessionClassSection[]): string {
  const used = new Set(sections.map((section) => section.name.trim().toUpperCase()));
  for (let code = 65; code <= 90; code++) {
    const letter = String.fromCharCode(code);
    if (!used.has(letter)) return letter;
  }
  return String(sections.length + 1);
}

/** Sections (A, B…) of a class: name, capacity, room, status; staff per saved section. */
export function ClassDetailSectionsTab({
  classId,
  sections,
  savedSectionIds,
  allFaculty,
  onChange,
}: ClassDetailSectionsTabProps): React.JSX.Element {
  const { t } = useTranslation();
  const terms = useAcademicTerms();
  const [staffSection, setStaffSection] = useState<SessionClassSection | null>(null);
  const { locked } = useSessionStructureLock();

  const update = (id: string, patch: Partial<SessionClassSection>) =>
    onChange(sections.map((section) => (section.id === id ? { ...section, ...patch } : section)));

  const add = () =>
    onChange([
      ...sections,
      {
        id: crypto.randomUUID(),
        classId,
        name: nextSectionName(sections),
        capacity: 30,
        room: "",
        status: "active",
      },
    ]);

  return (
    <div className="space-y-4">
      <FormCollectionShell
        title={terms.section.plural}
        icon={Users}
        isEmpty={sections.length === 0}
        emptyMessage={t("sessions.sections.empty")}
        addLabel={t("academicCatalog.add", { item: terms.section.singular })}
        onAdd={add}
        listKey="class-sections"
      >
        {sections.map((section, index) => {
          const saved = savedSectionIds.has(section.id);
          return (
            <FormListFieldCard
              key={section.id}
              id={section.id}
              index={index}
              removeLabel={t("sessions.classes.detail.removeItem")}
              canRemove={(section.enrolled ?? 0) === 0 && !(locked && saved)}
              onRemove={() => onChange(sections.filter((s) => s.id !== section.id))}
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                <Field
                  id={`section-name-${section.id}`}
                  label={t("sessions.sections.name")}
                  required
                >
                  <Input
                    id={`section-name-${section.id}`}
                    value={section.name}
                    maxLength={50}
                    onChange={(e) => update(section.id, { name: e.target.value })}
                  />
                </Field>
                <Field
                  id={`section-capacity-${section.id}`}
                  label={t("sessions.sections.capacity")}
                >
                  <Input
                    id={`section-capacity-${section.id}`}
                    inputMode="numeric"
                    value={String(section.capacity ?? 0)}
                    onChange={(e) =>
                      update(section.id, {
                        capacity: Math.max(0, parseInt(e.target.value, 10) || 0),
                      })
                    }
                  />
                </Field>
                <Field id={`section-room-${section.id}`} label={t("sessions.sections.room")}>
                  <Input
                    id={`section-room-${section.id}`}
                    value={section.room ?? ""}
                    maxLength={100}
                    onChange={(e) => update(section.id, { room: e.target.value })}
                  />
                </Field>
                <Field id={`section-status-${section.id}`} label={t("common.status")}>
                  <FormSelect
                    id={`section-status-${section.id}`}
                    value={section.status ?? "active"}
                    onChange={(value) =>
                      update(section.id, { status: value === "closed" ? "closed" : "active" })
                    }
                    options={[
                      { value: "active", label: t("sessions.sections.status.active") },
                      { value: "closed", label: t("sessions.sections.status.closed") },
                    ]}
                  />
                </Field>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                <span>
                  {t("sessions.sections.classTeacher")}:{" "}
                  <span className="text-foreground">
                    {section.classTeacherName || t("sessions.sections.noTeacher")}
                  </span>
                </span>
                <span>
                  {t("sessions.sections.enrolled")}:{" "}
                  <span className="tabular-nums text-foreground">{section.enrolled ?? 0}</span>
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="ms-auto min-h-11"
                  disabled={!saved}
                  title={saved ? undefined : t("sessions.sections.saveFirst")}
                  onClick={() => setStaffSection(section)}
                >
                  <Users className="size-4" aria-hidden />
                  {t("sessions.sections.manageStaff")}
                </Button>
              </div>
            </FormListFieldCard>
          );
        })}
      </FormCollectionShell>

      {staffSection ? (
        <SectionStaffModal
          open
          classId={classId}
          section={staffSection}
          allFaculty={allFaculty}
          onClose={() => setStaffSection(null)}
        />
      ) : null}
    </div>
  );
}
