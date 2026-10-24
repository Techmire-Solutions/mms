import { useRef, type JSX } from "react";
import { Printer, IdCard } from "lucide-react";
import { formatDate, facultyFieldLabelKey, type Faculty } from "@mms/shared";
import { Modal } from "@/components/app/Modal";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/app/UserAvatar";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/hooks/useTranslation";

export interface FacultyIdCardItem {
  faculty: Faculty;
  assignedClasses: string[];
  qualification?: string;
  emergencyPhone?: string;
}

export interface FacultyIdCardModalProps {
  open: boolean;
  onClose: () => void;
  items: FacultyIdCardItem[];
  madrasaName?: string;
}

export function FacultyIdCardModal({
  open,
  onClose,
  items,
  madrasaName = "Madrasa Management System",
}: FacultyIdCardModalProps): JSX.Element | null {
  const { t } = useTranslation();
  const printAreaRef = useRef<HTMLDivElement>(null);

  if (!open || items.length === 0) return null;

  const handlePrint = () => {
    window.print();
  };

  const isBatch = items.length > 1;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        isBatch
          ? t("faculty.idCard.batchPrint", { count: items.length })
          : t("faculty.idCard.title")
      }
      icon={IdCard}
      size="lg"
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="min-h-11 px-4 font-medium"
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 px-5 min-h-11 font-semibold"
          >
            <Printer className="w-4 h-4" />
            <span>{t("faculty.idCard.print")}</span>
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Printable Cards Container */}
        <div
          ref={printAreaRef}
          data-print-unclamp
          className="id-card-print-container grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-dialog-scroll overflow-y-auto p-2 print:grid-cols-2 print:gap-3 print:max-h-none print:overflow-visible print:p-0"
        >
          {items.map(({ faculty, assignedClasses, qualification, emergencyPhone }) => {
            const displayPhone =
              emergencyPhone || (faculty.phone ? String(faculty.phone) : undefined);

            return (
              <div
                key={faculty.id}
                className="id-card-preview relative border border-border/80 rounded-2xl p-4 bg-gradient-to-br from-card via-card/95 to-muted/30 shadow-sm overflow-hidden flex flex-col justify-between min-h-panel-sm print:shadow-none print:border-black/30 print:bg-white"
              >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-border/40 pb-2.5 mb-3">
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-foreground truncate tracking-tight">
                      {madrasaName}
                    </h4>
                    <p className="text-2xs uppercase font-semibold text-primary tracking-wider">
                      {t("faculty.idCard.title")}
                    </p>
                  </div>
                  {faculty.employeeId ? (
                    <Badge
                      as="span"
                      size="sm"
                      tone="primary"
                      className="px-1.5 py-0.5 rounded font-bold uppercase tracking-wider"
                    >
                      {t("faculty.employeeIdPrefix")}: {faculty.employeeId}
                    </Badge>
                  ) : null}
                </div>

                {/* Body Details */}
                <div className="flex items-start gap-3.5 my-auto">
                  <div className="shrink-0 flex flex-col items-center">
                    <UserAvatar
                      id={faculty.id}
                      name={faculty.name}
                      className="w-16 h-16 rounded-xl border-2 border-primary/30 shadow-inner font-bold text-sm"
                    />
                    {faculty.specialization && (
                      <span
                        title={faculty.specialization}
                        className="mt-1.5 text-4xs font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 max-w-20 truncate text-center"
                      >
                        {faculty.specialization}
                      </span>
                    )}
                    {faculty.department && (
                      <span
                        title={faculty.department}
                        className="mt-1 text-4xs font-medium px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground border border-border/40 max-w-20 truncate text-center"
                      >
                        {faculty.department}
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <h3
                      title={faculty.name}
                      className="text-sm font-bold text-foreground truncate leading-tight"
                    >
                      {faculty.name}
                    </h3>

                    {assignedClasses.length > 0 && (
                      <p
                        title={assignedClasses.join(", ")}
                        className="text-3xs font-medium text-primary truncate"
                      >
                        {assignedClasses.join(", ")}
                      </p>
                    )}

                    {(qualification || faculty.qualification) && (
                      <div
                        title={qualification || faculty.qualification}
                        className="text-3xs text-muted-foreground truncate"
                      >
                        <span className="font-semibold text-foreground/80">
                          {t(facultyFieldLabelKey("qualification"))}:{" "}
                        </span>
                        <span>{qualification || faculty.qualification}</span>
                      </div>
                    )}

                    {displayPhone && (
                      <div title={displayPhone} className="text-3xs text-muted-foreground truncate">
                        <span className="font-semibold text-foreground/80">
                          {t(facultyFieldLabelKey("phone"))}:{" "}
                        </span>
                        <span dir="ltr">{displayPhone}</span>
                      </div>
                    )}

                    {(faculty.employmentStartDate ?? faculty.joinDate) && (
                      <div className="text-2xs text-muted-foreground truncate">
                        <span>
                          {t(facultyFieldLabelKey("employmentStartDate"))}:{" "}
                          {faculty.employmentStartDate ?? faculty.joinDate}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between border-t border-border/40 pt-2 mt-3 text-4xs text-muted-foreground">
                  <div className="flex items-center gap-1 font-mono tracking-widest text-4xs uppercase">
                    <span>
                      {t("faculty.idCard.idLabel")}: {String(faculty.id).slice(0, 10)}
                    </span>
                  </div>
                  <div>
                    <span>
                      {t("faculty.idCard.issueDate")}: {formatDate(new Date())}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
