import React, { useState } from "react";
import { Plus, GraduationCap } from "lucide-react";
import { type Session, type Class } from '@/lib/data/sessionsData';
import { useTranslation } from '@/hooks/useTranslation';
import { useAcademicTerms } from '@/hooks/useAcademicTerms';
import { useFacultyByIds } from '@/tenant/hooks/collections/faculty';
import { collectFacultyIdsFromClasses } from '@/lib/registryResolve';
import { assignClassFaculty, resolveClassFacultyId, resolveClassFacultyName } from '@/lib/faculty/facultyAssignment';
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useMessageComposerState } from "@/hooks/useMessageComposerState";
import { ConfirmAlertDialog } from "@/components/ui/ConfirmAlertDialog";
import { ClassCard } from "@/tenant/features/sessions/components/tabs/ClassCard";
import { ClassModal } from "@/tenant/features/sessions/components/tabs/ClassModal";

import { isSessionStructureLocked } from '@mms/shared';
import { notify } from '@/lib/notify';
import { SessionStructureLockContext } from './sessionStructureLock';
const MessageComposer = React.lazy(() => import("@/tenant/components/messaging/TenantMessageComposer"));

interface ClassesTabProps {
  session: Session;
  onUpdate: (session: Session) => void | Promise<void>;
  canWrite: boolean;
}

/**
 * ClassesTab Component
 *
 * Renders the classes tab for a session, allowing managing individual classes.
 */
export function ClassesTab({ session, onUpdate, canWrite }: ClassesTabProps) {
  const { t } = useTranslation();
  const terms = useAcademicTerms();
  const locked = isSessionStructureLocked(session.status);
  const facultyIds = (() => collectFacultyIdsFromClasses(session.classes))();
  const { data: facultyMembers = [] } = useFacultyByIds(facultyIds);
  const { messagingTarget, openComposer, closeComposer } = useMessageComposerState();
  const [showModal, setShowModal] = useState(false);
  const [classBeingEdited, setClassBeingEdited] = useState<Class | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Class | null>(null);
  const [saving, setSaving] = useState(false);
  const deletePendingRef = React.useRef(false);

  const handleClassMessage = (channel: 'sms' | 'whatsapp' | 'email', sessionClass: Class) => {
    const assignedFacultyId = resolveClassFacultyId(sessionClass);
    const assignedFaculty = facultyMembers.find((f) => f.id === assignedFacultyId);
    const fallbackName = resolveClassFacultyName(sessionClass) || sessionClass.name;
    const recipientName = (assignedFaculty ? assignedFaculty.name : fallbackName) || t("sessions.classes.fallbackName");
    const phoneStr: string = assignedFaculty?.phone ?? "";
    const emailStr: string | undefined = assignedFaculty?.email ?? undefined;
    openComposer(channel, [{ id: sessionClass.id, name: recipientName, phone: phoneStr, email: emailStr }]);
  };

  const handleSave = async (sessionClass: Class) => {
    const assignedFacultyId = resolveClassFacultyId(sessionClass);
    const facultyFields = assignClassFaculty(assignedFacultyId);
    const updatedClass = { ...sessionClass, ...facultyFields };

    const classes = session.classes || [];
    const existing = classes.find((classItem) => classItem.id === updatedClass.id);
    const updatedClasses = existing
      ? classes.map((classItem) => classItem.id === updatedClass.id ? updatedClass : classItem)
      : [...classes, updatedClass];
    setSaving(true);
    try {
      await onUpdate({ ...session, classes: updatedClasses });
      setShowModal(false);
      setClassBeingEdited(null);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    deletePendingRef.current = true;
    try {
      await onUpdate({ ...session, classes: session.classes.filter((classItem) => classItem.id !== deleteTarget.id) });
      setDeleteTarget(null);
    } finally {
      deletePendingRef.current = false;
    }
  };

  const handleEdit = (sessionClass: Class) => { setClassBeingEdited(sessionClass); setShowModal(true); };

  return (
    <section aria-label={t("sessions.classes.ariaLabel")} className="space-y-4">
      <SectionHeader
        noMargin
        title={t("sessions.classes.count", { count: session.classes?.length || 0 })}
        actions={
          canWrite && (
            <Button
              onClick={() => { setClassBeingEdited(null); setShowModal(true); }}
              className="flex h-auto w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 sm:w-auto"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" /> {terms.class.singular}
            </Button>
          )
        }
      />

      {(!session.classes || session.classes.length === 0) ? (
        <EmptyState
          variant="dashed"
          icon={GraduationCap}
          title={t("sessions.classes.emptyTitle")}
          description={t("sessions.classes.emptySubtitle")}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {session.classes.map((sessionClass) => (
            <ClassCard key={sessionClass.id} sessionClass={sessionClass} faculty={facultyMembers} onEdit={handleEdit} onDelete={() => (locked
              ? notify.warning(t("sessions.lock.blocked", { fields: t("sessions.lock.field.classRemoved") }))
              : setDeleteTarget(sessionClass))} onMessage={handleClassMessage} canWrite={canWrite} />
          ))}
        </div>
      )}

      <SessionStructureLockContext.Provider value={{ locked, savedClassIds: new Set((session.classes ?? []).map((cls) => cls.id)) }}>
        <ClassModal
          open={showModal}
          sessionClass={classBeingEdited}
          onClose={() => { if (!saving) { setShowModal(false); setClassBeingEdited(null); } }}
          onSave={handleSave}
          saving={saving}
        />
      </SessionStructureLockContext.Provider>

      {canWrite && messagingTarget && (
        <React.Suspense fallback={null}>
          <MessageComposer
            channel={messagingTarget.channel}
            recipients={messagingTarget.recipients}
            onClose={closeComposer}
          />
        </React.Suspense>
      )}
      <ConfirmAlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open && !deletePendingRef.current) setDeleteTarget(null); }}
        title={t("sessions.classes.confirmDeleteTitle")}
        description={t("sessions.classes.confirmDeleteDescription", { name: deleteTarget?.name ?? "" })}
        confirmLabel={t("common.delete")}
        destructive
        onConfirm={() => { void handleDelete(); }}
      />
    </section>
  );
}
