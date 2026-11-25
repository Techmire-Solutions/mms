import { useState } from "react";
import type { Student } from "@mms/contracts";

/** Create/edit Student form overlay state for Students Work. */
export function useStudentsPageFormState() {
  const [showStudentForm, setShowStudentForm] = useState(false);
  const [editStudent, setEditStudent] = useState<Student | null>(null);

  const openCreateForm = () => {
    setEditStudent(null);
    setShowStudentForm(true);
  };

  const openEditForm = (studentToEdit: Student) => {
    setEditStudent(studentToEdit);
    setShowStudentForm(true);
  };

  const closeStudentForm = () => {
    setShowStudentForm(false);
    setEditStudent(null);
  };

  return {
    showStudentForm,
    editStudent,
    setEditStudent,
    openCreateForm,
    openEditForm,
    closeStudentForm,
  };
}
