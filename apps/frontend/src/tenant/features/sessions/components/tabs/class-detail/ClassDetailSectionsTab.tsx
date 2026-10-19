import React, { useState } from "react";
import { Combine, Split, Users, XCircle } from "lucide-react";
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
import { useSectionOperations } from "@/tenant/features/sessions/hooks/useSectionOperations";
import { SectionOperationModal, type SectionOperationKind } from "./SectionOperationModal";

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
  const [operation, setOperation] = useState<{
    kind: SectionOperationKind;
    section: SessionClassSection;
  } | null>(null);
  const sectionOps = useSectionOperations();

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
                {saved && section.status !== "closed" ? (
                  <span className="flex flex-wrap gap-2">
                    {(
                      [
                        ["merge", Combine, "sessions.sections.ops.merge"],
                        ["split", Split, "sessions.sections.ops.splitAction"],
                        ["close", XCircle, "sessions.sections.ops.close"],
                      ] as const
                    ).map(([kind, Icon, label]) => (
                      <Button
                        key={kind}
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="min-h-11"
                        disabled={sectionOps.isPending}
                        onClick={() => setOperation({ kind, section })}
                      >
                        <Icon className="size-4" aria-hidden />
                        {t(label)}
                      </Button>
                    ))}
                  </span>
                ) : null}
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

      {operation ? (
        <SectionOperationModal
          kind={operation.kind}
          classId={classId}
          section={operation.section}
          siblings={sections.filter(
            (row) =>
              row.id !== operation.section.id &&
              row.status !== "closed" &&
              savedSectionIds.has(row.id),
          )}
          isPending={sectionOps.isPending}
          onDismiss={() => setOperation(null)}
          onMerge={async (body) => {
            const done = await sectionOps.merge(operation.section.id, body);
            if (done) update(operation.section.id, { status: "closed" });
            return Boolean(done);
          }}
          onSplit={async (body) => {
            const done = await sectionOps.split(operation.section.id, body);
            // Keep the open draft in step so a later Save does not drop the new section.
            if (done)
              onChange([
                ...sections,
                {
                  id: done.sectionId,
                  classId,
                  name: body.name,
                  capacity: body.capacity,
                  room: "",
                  status: "active",
                  enrolled: done.moved,
                },
              ]);
            return Boolean(done);
          }}
          onCloseSection={async (body) => {
            const done = await sectionOps.close(operation.section.id, body);
            if (done) update(operation.section.id, { status: "closed" });
            return Boolean(done);
          }}
        />
      ) : null}

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
