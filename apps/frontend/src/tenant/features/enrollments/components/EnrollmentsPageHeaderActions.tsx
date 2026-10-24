import React from "react";
import { Download, Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

import { type useTranslation } from "@/hooks/useTranslation";

export interface EnrollmentsPageHeaderActionsProps {
  canExport: boolean;
  canWriteEnrollments: boolean;
  showDeleted: boolean;
  t: ReturnType<typeof useTranslation>["t"];
  onExport: () => void;
  onNew: () => void;
  onImport?: () => void;
}

export function EnrollmentsPageHeaderActions({
  canExport,
  canWriteEnrollments,
  showDeleted,
  t,
  onExport,
  onNew,
  onImport,
}: EnrollmentsPageHeaderActionsProps): React.JSX.Element {
  return (
    <div className="flex items-center gap-2">
      {canExport && !showDeleted ? (
        <Button variant="ghost" icon={Download} onClick={onExport}>
          {t("common.export")}
        </Button>
      ) : null}
      {canWriteEnrollments && !showDeleted && onImport && (
        <Button variant="outline" icon={Upload} onClick={onImport}>
          {t("common.import")}
        </Button>
      )}
      {canWriteEnrollments && !showDeleted && (
        <Button variant="primary" icon={Plus} onClick={onNew}>
          {t("enrollments.new")}
        </Button>
      )}
    </div>
  );
}
