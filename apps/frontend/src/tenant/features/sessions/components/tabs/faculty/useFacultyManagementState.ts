import { useState, useMemo } from "react";
import { useFacultyContractList, useFacultyByIds } from "@/tenant/hooks/collections/faculty";
import { FACULTY_MODULE_MANIFEST, formatFacultyDisplayName, type FacultyMember } from "@mms/shared";
import type { Session, SessionFaculty } from "@/lib/data/sessionsData";
import { COMMON_FACULTY_ROLES } from "./facultyManagementShared";

export function useFacultyManagementState(
  session: Session,
  onUpdate: (updatedSession: Session) => void | Promise<void>,
) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingFaculty, setEditingFaculty] = useState<SessionFaculty | null>(null);
  const [facultyId, setFacultyId] = useState("");
  const [role, setRole] = useState("Lead Instructor");
  const [customRole, setCustomRole] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [saving, setSaving] = useState(false);

  const { data: facultyData } = useFacultyContractList(
    { page: 1, limit: FACULTY_MODULE_MANIFEST.maxPageSize, status: "active" },
    modalOpen,
  );

  const facultyList = (facultyData?.body?.faculty ?? []) as FacultyMember[];

  const selectedFacultyIds = facultyId ? [facultyId] : [];
  const { data: selectedFacultyData } = useFacultyByIds(selectedFacultyIds);
  const selectedFaculty = (selectedFacultyData ?? []) as FacultyMember[];

  const allFaculty = useMemo(() => {
    const map = new Map<string, FacultyMember>();
    for (const f of facultyList) {
      if (f?.id) map.set(String(f.id), f);
    }
    for (const f of selectedFaculty) {
      if (f?.id && !map.has(String(f.id))) {
        map.set(String(f.id), f);
      }
    }
    return Array.from(map.values());
  }, [facultyList, selectedFaculty]);

  const handleOpenAdd = () => {
    setEditingFaculty(null);
    setFacultyId(allFaculty[0]?.id ? String(allFaculty[0].id) : "");
    setRole("Lead Instructor");
    setCustomRole("");
    setStatus("active");
    setModalOpen(true);
  };

  const handleOpenEdit = (item: SessionFaculty) => {
    setEditingFaculty(item);
    setFacultyId(item.facultyId || "");
    if (COMMON_FACULTY_ROLES.includes(item.role)) {
      setRole(item.role);
      setCustomRole("");
    } else {
      setRole("Custom");
      setCustomRole(item.role);
    }
    setStatus(item.status);
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    const updated = (session.faculty || []).filter((f) => f.id !== id);
    await onUpdate({ ...session, faculty: updated });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const selectedMember = allFaculty.find((f) => String(f.id) === String(facultyId));
      const resolvedName = selectedMember
        ? formatFacultyDisplayName(selectedMember) ||
          editingFaculty?.facultyName ||
          "Faculty Member"
        : editingFaculty?.facultyName || "Faculty Member";

      const finalRole = role === "Custom" ? customRole.trim() || "Instructor" : role;
      const updatedFaculty = [...(session.faculty || [])];

      if (editingFaculty) {
        const index = updatedFaculty.findIndex((f) => f.id === editingFaculty.id);
        if (index >= 0) {
          updatedFaculty[index] = {
            ...editingFaculty,
            facultyId: facultyId || editingFaculty.facultyId,
            facultyName: resolvedName,
            role: finalRole,
            status,
          };
        }
      } else {
        const newEntry: SessionFaculty = {
          id: crypto.randomUUID(),
          sessionId: session.id,
          facultyId: facultyId || "unassigned",
          facultyName: resolvedName,
          role: finalRole,
          status,
        };
        updatedFaculty.push(newEntry);
      }

      await onUpdate({ ...session, faculty: updatedFaculty });
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return {
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
  };
}
