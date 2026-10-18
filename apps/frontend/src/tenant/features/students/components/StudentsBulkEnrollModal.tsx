import type React from "react";
import { useState } from "react";
import { BookOpen } from "lucide-react";
import type { StudentsBulkEnrollPlacement } from "@mms/shared";
import { FormModal } from "@/components/ui/FormModal";
import { Field, FormSelect } from "@/components/ui/FormPrimitives";
import { useTranslation } from "@/hooks/useTranslation";
import { useAcademicTerms } from "@/hooks/useAcademicTerms";
import { useSessionsCollection } from "@/tenant/hooks/collections/sessions";

export interface StudentsBulkEnrollModalProps {
  open: boolean;
  onClose: () => void;
  selectedCount: number;
  onConfirm: (payload: StudentsBulkEnrollPlacement) => Promise<void> | void;
  isPending?: boolean;
}

type Mode = StudentsBulkEnrollPlacement["mode"];

/** Bulk enroll selected students into one class/section, or cancel their enrollment in a session. */
export function StudentsBulkEnrollModal({ open, onClose, selectedCount, onConfirm, isPending = false }: StudentsBulkEnrollModalProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const terms = useAcademicTerms();
  const sessions = useSessionsCollection();
  const [mode, setMode] = useState<Mode>("add");
  const [sessionId, setSessionId] = useState("");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");

  if (!open) return null;

  const session = sessions.find((s) => String(s.id) === sessionId);
  const sessionClass = session?.classes?.find((c) => c.id === classId);
  const sections = (sessionClass?.sections ?? []).filter((section) => section.status !== "closed");
  const ready = Boolean(sessionId) && (mode === "remove" || Boolean(classId));

  const handleSave = async () => {
    if (!ready) return;
    await onConfirm(mode === "remove"
      ? { mode, sessionId }
      : { mode, sessionId, classId, ...(sectionId ? { sectionId } : {}) });
    setSessionId("");
    setClassId("");
    setSectionId("");
    onClose();
  };

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={t("students.bulkEnrollTitle")}
      icon={BookOpen}
      size="md"
      cancelLabel={t("common.cancel")}
      saveLabel={t("students.bulkEnroll")}
      onSave={handleSave}
      saving={isPending}
      saveDisabled={isPending || !ready}
    >
      <div className="space-y-5 text-start">
        <p className="m-0 text-sm text-muted-foreground">{t("students.bulkEnrollClassDesc", { count: selectedCount })}</p>
        <Field id="bulk-enroll-mode" label={t("students.bulkEnrollMode")} required>
          <FormSelect
            id="bulk-enroll-mode"
            value={mode}
            onChange={(value) => setMode(value === "remove" ? "remove" : "add")}
            options={[
              { value: "add", label: t("students.bulkEnrollModeEnroll") },
              { value: "remove", label: t("students.bulkEnrollModeCancel") },
            ]}
          />
        </Field>
        <Field id="bulk-enroll-session" label={t("students.bulkEnrollSession")} required>
          <FormSelect
            id="bulk-enroll-session"
            value={sessionId}
            onChange={(value) => { setSessionId(value); setClassId(""); setSectionId(""); }}
            placeholder={t("students.bulkEnrollSelectSessions")}
            options={sessions.filter((s) => !s.deletedAt).map((s) => ({ value: String(s.id), label: s.name }))}
          />
        </Field>
        {mode === "add" ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field id="bulk-enroll-class" label={terms.class.singular} required>
              <FormSelect
                id="bulk-enroll-class"
                value={classId}
                disabled={!session}
                onChange={(value) => { setClassId(value); setSectionId(""); }}
                options={(session?.classes ?? []).map((c) => ({ value: c.id, label: c.name }))}
              />
            </Field>
            {sections.length > 1 ? (
              <Field id="bulk-enroll-section" label={terms.section.singular}>
                <FormSelect
                  id="bulk-enroll-section"
                  value={sectionId}
                  onChange={setSectionId}
                  placeholder={t("common.allSections")}
                  options={sections.map((section) => ({ value: section.id, label: `${section.name} (${section.enrolled ?? 0}/${section.capacity})` }))}
                />
              </Field>
            ) : null}
          </div>
        ) : null}
      </div>
    </FormModal>
  );
}
