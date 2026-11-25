import React from "react";
import { User } from "lucide-react";
import { DetailDrawerShell } from "@mms/fe-core/components/DetailDrawerShell";
import { type Enrollment } from "../lib/enrollmentData";
import { useStudentsByIds } from "../host/studentsCollection";
import { StatusBadge } from "@mms/fe-core/components/StatusBadge";
import {
  enrollmentPaymentBadgeConfig,
  enrollmentStatusBadgeConfig,
} from "../host/enrollmentStatusBadge";
import { useFinanceCurrency } from "../host/useCurrency";
import { useTranslation } from "@mms/fe-core/i18n";
import { EnrollmentArchivedBanner } from "./EnrollmentArchivedBanner";
import { DetailDrawerRestoreOrEditAction } from "@mms/fe-core/components/DetailDrawerArchiveChrome";
import { EnrollmentDetailSections } from "./EnrollmentDetailSections";
import { EnrollmentOperationsPanel } from "./EnrollmentOperationsPanel";

export interface EnrollmentDetailProps {
  enrollment: Enrollment | null | undefined;
  onClose: () => void;
  onStatusChange: (id: string, newStatus: Enrollment["status"]) => void;
  onPaymentStatusChange: (id: string, newStatus: Enrollment["paymentStatus"]) => void;
  canWrite: boolean;
  canManage?: boolean;
  canDelete?: boolean;
  onRestore?: (id: string) => void;
}

export const EnrollmentDetail = function EnrollmentDetail({
  enrollment,
  onClose,
  onStatusChange,
  onPaymentStatusChange,
  canWrite,
  canManage = false,
  canDelete,
  onRestore,
}: EnrollmentDetailProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const { data: resolvedStudents = [] } = useStudentsByIds(
    enrollment ? [enrollment.studentId] : [],
  );
  const { formatCurrency } = useFinanceCurrency();
  const student = resolvedStudents[0];

  const statusConfig = enrollmentStatusBadgeConfig(t);

  const paymentConfig = enrollmentPaymentBadgeConfig(t);

  if (!enrollment) return null;

  const isArchived = Boolean(enrollment.deletedAt);

  const headerExtraNode = (
    <div className="flex flex-col gap-2 mt-1">
      {enrollment.deletedAt && <EnrollmentArchivedBanner enrollment={enrollment} />}
      <div className="flex items-center gap-2">
        <StatusBadge status={enrollment.status} config={statusConfig} />
        {enrollment.paymentStatus && (
          <StatusBadge status={enrollment.paymentStatus} config={paymentConfig} />
        )}
      </div>
    </div>
  );

  const headerActions = onRestore ? (
    <DetailDrawerRestoreOrEditAction
      isArchived={isArchived}
      canRestore={Boolean(canDelete)}
      canEdit={false}
      restoreLabel={t("enrollments.restore")}
      editLabel=""
      onRestore={onRestore ? () => onRestore(enrollment.id) : undefined}
    />
  ) : undefined;

  return (
    <DetailDrawerShell
      open={Boolean(enrollment)}
      onClose={onClose}
      title={student?.name || enrollment.studentName}
      subtitle={`${enrollment.sessionName} · #${enrollment.id}`}
      icon={User}
      ariaLabel={t("enrollments.detail.ariaLabel")}
      className="max-w-2xl"
      headerActions={headerActions}
      headerExtra={headerExtraNode}
    >
      <EnrollmentDetailSections
        enrollment={enrollment}
        student={student}
        formatCurrency={formatCurrency}
        statusConfig={statusConfig}
        paymentConfig={paymentConfig}
        canWrite={canWrite}
        canManage={canManage}
        isArchived={isArchived}
        onStatusChange={onStatusChange}
        onPaymentStatusChange={onPaymentStatusChange}
      />
      <EnrollmentOperationsPanel
        enrollment={enrollment}
        canWrite={canWrite}
        canManage={canManage}
        isArchived={isArchived}
      />
    </DetailDrawerShell>
  );
};
