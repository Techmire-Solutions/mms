import { Briefcase, ChevronDown, IdCard, Users } from "lucide-react";
import { FACULTY_MODULE_MANIFEST, type Faculty } from "@mms/shared";
import { BulkSelectionBar } from "@/components/app/BulkSelectionBar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type StatusBadgeConfigItem } from "@/components/app/StatusBadge";
import { useTranslation } from "@/hooks/useTranslation";
import type { FacultySelectionTargets } from "@/tenant/features/faculty/hooks/facultySelectionTargets";

export interface FacultyBulkActionBarProps {
  selectedIds: string[];
  selectionTargets: FacultySelectionTargets;
  showDeleted: boolean;
  canWrite: boolean;
  canDelete: boolean;
  canWriteMessaging?: boolean;
  statusConfig: Record<string, StatusBadgeConfigItem>;
  specializationOptions?: readonly string[];
  onSms?: (faculty: Faculty[]) => void;
  onWhatsApp?: (faculty: Faculty[]) => void;
  onEmail?: (faculty: Faculty[]) => void;
  onBulkStatusChange?: (status: string) => void;
  onBulkSpecializationChange?: (specialization: string) => void;
  onBulkPrintIdCards?: () => void;
  onRequestBulkDelete: () => void;
  onRequestBulkRestore: () => void;
  onClearSelection: () => void;
  canExport?: boolean;
  onBulkExport?: () => void;
  bulkActions?: readonly string[];
  /** Disables the bulk status action while the status mutation is pending. */
  statusPending?: boolean;
  specializationPending?: boolean;
}

/** Faculty Work bulk bar — delegates core actions to BulkSelectionBar. */
export function FacultyBulkActionBar({
  selectedIds,
  selectionTargets,
  showDeleted,
  canWrite,
  canDelete,
  canWriteMessaging = false,
  statusConfig,
  specializationOptions,
  onSms,
  onWhatsApp,
  onEmail,
  onBulkStatusChange,
  onBulkSpecializationChange,
  onBulkPrintIdCards,
  onRequestBulkDelete,
  onRequestBulkRestore,
  onClearSelection,
  canExport = false,
  onBulkExport,
  bulkActions = FACULTY_MODULE_MANIFEST.work.bulkActions,
  statusPending = false,
  specializationPending = false,
}: FacultyBulkActionBarProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <BulkSelectionBar<Faculty>
      selectedCount={selectedIds.length}
      viewingDeleted={showDeleted}
      canWrite={canWrite}
      canDelete={canDelete}
      canExport={canExport}
      canWriteMessaging={canWriteMessaging}
      leadingIcon={Users}
      i18nNamespace="faculty"
      bulkActions={bulkActions}
      onClearSelection={onClearSelection}
      onRequestBulkDelete={onRequestBulkDelete}
      onRequestBulkRestore={onRequestBulkRestore}
      onBulkExport={onBulkExport}
      statusConfig={statusConfig}
      onBulkStatusChange={onBulkStatusChange}
      statusPending={statusPending}
      messagingTargets={selectionTargets}
      onWhatsApp={onWhatsApp}
      onSms={onSms}
      onEmail={onEmail}
      extraActions={
        !showDeleted && (onBulkSpecializationChange || onBulkPrintIdCards) ? (
          <div className="flex items-center gap-1.5 flex-wrap">
            {canWrite &&
              bulkActions.includes("specialization") &&
              onBulkSpecializationChange &&
              specializationOptions &&
              specializationOptions.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={specializationPending}
                      className="min-h-11 gap-1.5 px-3 font-medium text-xs border-border/60 hover:bg-muted/80"
                    >
                      <Briefcase className="w-3.5 h-3.5" aria-hidden />
                      <span>{t("faculty.bulkSpecialization")}</span>
                      <ChevronDown className="w-3 h-3 text-muted-foreground" aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                    {specializationOptions.map((spec) => (
                      <DropdownMenuItem
                        key={spec}
                        onClick={() => onBulkSpecializationChange(spec)}
                        className="text-xs"
                      >
                        {spec}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            {onBulkPrintIdCards && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onBulkPrintIdCards}
                className="min-h-11 gap-1.5 px-3 font-medium text-xs border-border/60 hover:bg-muted/80"
              >
                <IdCard className="w-3.5 h-3.5" aria-hidden />
                <span>{t("faculty.idCard.print")}</span>
              </Button>
            )}
          </div>
        ) : undefined
      }
    />
  );
}
