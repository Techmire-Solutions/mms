import { useState } from "react";
import type { Session } from "@/lib/data/sessionsData";

export function useSessionsDialogs(onDeleteConfirm?: (id: string, reason?: string) => void) {
  const [showForm, setShowForm] = useState(false);
  const [editSession, setEditSession] = useState<Session | null>(null);
  const [detailSession, setDetailSession] = useState<Session | null>(null);
  const [confirmBulkDeleteOpen, setConfirmBulkDeleteOpen] = useState(false);
  const [confirmBulkRestoreOpen, setConfirmBulkRestoreOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const openCreateForm = () => {
    setEditSession(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditSession(null);
  };

  const openEditForm = (sessionToEdit: Session) => {
    setEditSession(sessionToEdit);
    setShowForm(true);
  };

  const confirmDelete = (deletionReason?: string) => {
    if (pendingDeleteId && onDeleteConfirm) {
      onDeleteConfirm(pendingDeleteId, deletionReason);
    }
    setPendingDeleteId(null);
  };

  return {
    showForm,
    setShowForm,
    editSession,
    setEditSession,
    detailSession,
    setDetailSession,
    confirmBulkDeleteOpen,
    setConfirmBulkDeleteOpen,
    confirmBulkRestoreOpen,
    setConfirmBulkRestoreOpen,
    pendingDeleteId,
    setPendingDeleteId,
    openCreateForm,
    closeForm,
    openEditForm,
    confirmDelete,
  };
}
