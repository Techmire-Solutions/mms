import type React from "react";
import { useState } from "react";
import { BookOpen } from "lucide-react";
import { FormModal } from "@/components/ui/FormModal";
import { useTranslation } from "@/hooks/useTranslation";
import { useSessions, useSessionsCollection } from "@/tenant/hooks/collections/sessions";
import type { StudentsBulkEnrollBody } from "@mms/shared";
import { cn } from "@/lib/utils";
import { RadioGroup, RadioGroupItem } from "@/components/ui/RadioGroup";
import { StudentsBulkEnrollSessionList } from "@/tenant/features/students/components/StudentsBulkEnrollSessionList";

export interface StudentsBulkEnrollModalProps {
  open: boolean;
  onClose: () => void;
  selectedCount: number;
  onConfirm: (payload: {
    sessionIds: string[];
    mode: StudentsBulkEnrollBody["mode"];
  }) => Promise<void> | void;
  isPending?: boolean;
}

export function StudentsBulkEnrollModal({
  open,
  onClose,
  selectedCount,
  onConfirm,
  isPending = false,
}: StudentsBulkEnrollModalProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const sessionsQuery = useSessions();
  const sessions = useSessionsCollection();

  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const [mode, setMode] = useState<StudentsBulkEnrollBody["mode"]>("add");

  if (!open) return null;

  const toggleSession = (id: string) => {
    setSelectedSessionIds((prev) => {
      const nextSet = new Set(prev);
      if (nextSet.has(id)) {
        nextSet.delete(id);
      } else {
        nextSet.add(id);
      }
      return [...nextSet];
    });
  };

  const handleSelectAll = () => {
    if (selectedSessionIds.length === sessions.length) {
      setSelectedSessionIds([]);
    } else {
      setSelectedSessionIds(sessions.map((s) => String(s.id)));
    }
  };

  const handleSave = async () => {
    if (selectedSessionIds.length === 0) return;
    await onConfirm({ sessionIds: selectedSessionIds, mode });
    setSelectedSessionIds([]);
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
      saveDisabled={isPending || selectedSessionIds.length === 0}
      formId="students-bulk-enroll-modal-form"
    >
      <form
        id="students-bulk-enroll-modal-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (selectedSessionIds.length > 0 && !isPending) void handleSave();
        }}
        className="space-y-5 text-start"
      >
        <p className="text-sm text-muted-foreground m-0">
          {t("students.bulkEnrollDesc", { count: selectedCount })}
        </p>

        {/* Action Mode Radio Group */}
        <div className="space-y-2">
          <span className="text-xs font-semibold text-foreground" id="bulk-enroll-mode-label">
            {t("students.bulkEnrollMode")}
          </span>
          <RadioGroup
            value={mode}
            onValueChange={(val) => setMode(val as "add" | "replace" | "remove")}
            aria-labelledby="bulk-enroll-mode-label"
            className="grid grid-cols-1 sm:grid-cols-3 gap-2"
          >
            {(
              [
                { id: "add", label: t("students.bulkEnrollModeAdd") },
                { id: "replace", label: t("students.bulkEnrollModeReplace") },
                { id: "remove", label: t("students.bulkEnrollModeRemove") },
              ] as const
            ).map((opt) => {
              const isSelected = mode === opt.id;
              return (
                <label
                  key={opt.id}
                  htmlFor={`bulk-mode-${opt.id}`}
                  className={cn(
                    "flex items-center gap-2 p-3 rounded-xl border text-xs transition-colors min-h-11 cursor-pointer",
                    isSelected
                      ? "border-primary bg-primary/10 text-foreground font-medium ring-1 ring-primary"
                      : "border-border/60 hover:bg-muted/50 text-muted-foreground",
                  )}
                >
                  <RadioGroupItem
                    id={`bulk-mode-${opt.id}`}
                    value={opt.id}
                    className="h-5 w-5 min-h-5 min-w-5"
                  />
                  <span className="leading-tight">{opt.label}</span>
                </label>
              );
            })}
          </RadioGroup>
        </div>

        <StudentsBulkEnrollSessionList
          sessions={sessions}
          isLoading={sessionsQuery.isLoading}
          selectedSessionIds={selectedSessionIds}
          onToggleSession={toggleSession}
          onSelectAll={handleSelectAll}
        />
      </form>
    </FormModal>
  );
}
