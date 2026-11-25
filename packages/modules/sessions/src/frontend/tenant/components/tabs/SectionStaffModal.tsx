import React, { useState } from "react";
import { Users } from "lucide-react";
import type { FacultyMember, SessionClassSection } from "@mms/contracts";
import { Modal } from "@mms/fe-core/components/Modal";
import { useTranslation } from "@mms/fe-core/i18n";
import { SectionStaffPanel } from "./SectionStaffPanel";
import { SectionStudentRolesPanel } from "./SectionStudentRolesPanel";

type Tab = "staff" | "students";

export interface SectionStaffModalProps {
  open: boolean;
  classId: string;
  section: SessionClassSection;
  allFaculty: FacultyMember[];
  onClose: () => void;
}

/** Section staff (class / subject / assistant teachers, effective-dated) and student roles. */
export function SectionStaffModal({
  open,
  classId,
  section,
  allFaculty,
  onClose,
}: SectionStaffModalProps): React.JSX.Element {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("staff");
  return (
    // A two-tab management panel (list + inline add), not a single create/edit form, so the
    // list-capable `Modal` is the right shell here rather than `FormModal`.
    <Modal
      open={open}
      onClose={onClose}
      priority
      size="2xl"
      icon={Users}
      title={t("sessions.staff.title", { section: section.name })}
      tabs={[
        { key: "staff", label: t("sessions.sections.manageStaff") },
        { key: "students", label: t("sessions.studentRoles.title") },
      ]}
      activeTab={tab}
      onTabChange={setTab}
    >
      {tab === "staff" ? (
        <SectionStaffPanel sectionId={section.id} allFaculty={allFaculty} />
      ) : (
        <SectionStudentRolesPanel sectionId={section.id} classId={classId} />
      )}
    </Modal>
  );
}
