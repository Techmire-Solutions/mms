import { useState } from "react";
import type { Faculty } from "@mms/shared";

/** Create/edit Faculty form overlay state (Students-shaped page form state). */
export function useFacultyPageFormState() {
  const [showForm, setShowForm] = useState(false);
  const [editFaculty, setEditFaculty] = useState<Faculty | null>(null);

  const openCreate = () => {
    setEditFaculty(null);
    setShowForm(true);
  };

  const openEdit = (facultyToEdit: Faculty) => {
    setEditFaculty(facultyToEdit);
    setShowForm(true);
  };

  const close = () => {
    setShowForm(false);
    setEditFaculty(null);
  };

  return {
    showForm,
    editFaculty,
    setEditFaculty,
    setShowForm,
    openCreate,
    openEdit,
    close,
  };
}
