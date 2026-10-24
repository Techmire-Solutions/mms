import { useState } from "react";
import type { Contact } from "@mms/shared";
import { useWorkDirectoryViewMode } from "@/hooks/useWorkDirectoryViewMode";

/** Overlay / dialog UI state for Contacts Work (form, drawer, duplicates, import, bulk confirms). */
export function useContactsPageOverlayState() {
  const { viewMode, setViewMode } = useWorkDirectoryViewMode();
  const [showForm, setShowForm] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [viewContact, setViewContact] = useState<Contact | null>(null);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [openingDuplicates, setOpeningDuplicates] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [csvImportOpen, setCsvImportOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkRestoreOpen, setBulkRestoreOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string | number; name?: string } | null>(
    null,
  );
  const [conflictPanelOpen, setConflictPanelOpen] = useState(false);

  return {
    showForm,
    setShowForm,
    editContact,
    setEditContact,
    viewContact,
    setViewContact,
    showDuplicates,
    setShowDuplicates,
    openingDuplicates,
    setOpeningDuplicates,
    importOpen,
    setImportOpen,
    csvImportOpen,
    setCsvImportOpen,
    bulkDeleteOpen,
    setBulkDeleteOpen,
    bulkRestoreOpen,
    setBulkRestoreOpen,
    deleteTarget,
    setDeleteTarget,
    viewMode,
    setViewMode,
    conflictPanelOpen,
    setConflictPanelOpen,
  };
}
