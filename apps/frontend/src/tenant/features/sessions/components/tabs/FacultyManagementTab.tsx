/**
 * @file FacultyManagementTab.tsx
 * @description Model 6 Session Faculty Management tab (dynamic roles, faculty selector, active/inactive status).
 */
import React from "react";
import { UserCheck, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/app/EmptyState";
import { useTranslation } from "@/hooks/useTranslation";
import { SessionFacultyCard } from "./faculty/SessionFacultyCard";
import { SessionFacultyFormModal } from "./faculty/SessionFacultyFormModal";
import { useFacultyManagementState } from "./faculty/useFacultyManagementState";
import type { FacultyManagementTabProps } from "./faculty/facultyManagementShared";

export type { FacultyManagementTabProps };

export function FacultyManagementTab({
  session,
  onUpdate,
  canMutate,
}: FacultyManagementTabProps): React.JSX.Element {
  const { t } = useTranslation();
  const {
    modalOpen,
    setModalOpen,
    editingFaculty,
    facultyId,
    setFacultyId,
    role,
    setRole,
    customRole,
    setCustomRole,
    status,
    setStatus,
    saving,
    allFaculty,
    handleOpenAdd,
    handleOpenEdit,
    handleDelete,
    handleSave,
  } = useFacultyManagementState(session, onUpdate);

  const facultyItems = session.faculty || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{t("sessions.faculty.title")}</h3>
          <p className="text-xs text-muted-foreground">{t("sessions.faculty.subtitle")}</p>
        </div>
        {canMutate && (
          <Button size="sm" onClick={handleOpenAdd} className="gap-1.5">
            <Plus className="h-4 w-4" />
            {t("sessions.faculty.add")}
          </Button>
        )}
      </div>

      {facultyItems.length === 0 ? (
        <EmptyState
          icon={UserCheck}
          title={t("sessions.faculty.emptyTitle")}
          description={t("sessions.faculty.emptyDescription")}
          action={
            canMutate ? (
              <Button size="sm" onClick={handleOpenAdd} className="gap-1.5">
                <Plus className="h-4 w-4" />
                {t("sessions.faculty.add")}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {facultyItems.map((item) => (
            <SessionFacultyCard
              key={item.id}
              item={item}
              canMutate={canMutate}
              onEdit={handleOpenEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <SessionFacultyFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editingFaculty={editingFaculty}
        saving={saving}
        facultyId={facultyId}
        onFacultyIdChange={setFacultyId}
        role={role}
        onRoleChange={setRole}
        customRole={customRole}
        onCustomRoleChange={setCustomRole}
        status={status}
        onStatusChange={setStatus}
        allFaculty={allFaculty}
        onSave={handleSave}
      />
    </div>
  );
}
