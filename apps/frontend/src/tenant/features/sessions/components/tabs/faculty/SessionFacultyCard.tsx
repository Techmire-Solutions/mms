import React from "react";
import { UserCheck, Edit2, Trash2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SessionFaculty } from "@/lib/data/sessionsData";
import { useTranslation } from "@/hooks/useTranslation";

interface SessionFacultyCardProps {
  item: SessionFaculty;
  canMutate: boolean;
  onEdit: (item: SessionFaculty) => void;
  onDelete: (id: string) => void;
}

export function SessionFacultyCard({
  item,
  canMutate,
  onEdit,
  onDelete,
}: SessionFacultyCardProps): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between rounded-xl border border-border/70 bg-card p-3 shadow-xs transition-colors hover:border-border">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary font-medium">
          <UserCheck className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {item.facultyName || t("sessions.faculty.selectFaculty")}
          </p>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded bg-muted px-1.5 py-0.5 font-medium text-foreground/80">
              {item.role}
            </span>
            <span className="flex items-center gap-1">
              {item.status === "active" ? (
                <CheckCircle2 className="h-3 w-3 text-success" />
              ) : (
                <XCircle className="h-3 w-3 text-muted-foreground" />
              )}
              <span className="capitalize">{item.status}</span>
            </span>
          </div>
        </div>
      </div>

      {canMutate && (
        <div className="flex items-center gap-1 shrink-0 ms-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 touch-target-coarse text-muted-foreground hover:text-foreground"
            onClick={() => onEdit(item)}
            aria-label={t("sessions.faculty.editAria")}
          >
            <Edit2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 touch-target-coarse text-muted-foreground hover:text-destructive"
            onClick={() => onDelete(item.id)}
            aria-label={t("sessions.faculty.deleteAria")}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
