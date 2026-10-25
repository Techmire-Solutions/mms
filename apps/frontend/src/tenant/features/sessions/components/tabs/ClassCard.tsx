import {
  Edit2,
  MessageCircle,
  MessageSquare,
  Trash2,
  Users,
  DollarSign,
  Clock,
} from "lucide-react";
import type { FacultyMember } from "@mms/shared";

import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/app/ProgressBar";
import { StatusBadge, type StatusBadgeConfigItem } from "@/components/app/StatusBadge";
import { DirectoryEntityCard } from "@/components/app/DirectoryEntityCard";
import { EntityCard } from "@/components/app/EntityCard";
import { DirectoryCardMetaTile } from "@/components/app/DirectoryCardMetaTile";
import { useTranslation } from "@/hooks/useTranslation";
import type { Class } from "@/lib/data/sessionsData";
import { genderStatusBadgeConfig } from "@/lib/ui/genderStatusBadge";
import {
  facultyNameById,
  resolveClassFacultyId,
  resolveClassFacultyName,
} from "@/lib/faculty/facultyAssignment";

interface ClassCardProps {
  sessionClass: Class;
  faculty?: FacultyMember[];
  onEdit: (sessionClass: Class) => void;
  onDelete: (id: string) => void;
  onMessage?: (channel: "sms" | "whatsapp" | "email", sessionClass: Class) => void;
  canWrite: boolean;
}

/** Work directory card — DirectoryEntityCard SSOT (do not hand-compose EntityCard). */
export function ClassCard({
  sessionClass,
  faculty,
  onEdit,
  onDelete,
  onMessage,
  canWrite,
}: ClassCardProps) {
  const { t } = useTranslation();
  const allFaculty = faculty ?? [];
  const rawCapacity = Reflect.get(sessionClass, "capacity");
  const maxCapacity =
    sessionClass.maxStudents ?? (typeof rawCapacity === "number" ? rawCapacity : 30);
  const enrolledCount = sessionClass.enrolled ?? 0;
  const capacityPercent = Math.round((enrolledCount / Math.max(1, maxCapacity)) * 100);
  const barColor =
    capacityPercent >= 100 ? "bg-destructive" : capacityPercent >= 80 ? "bg-warning" : "bg-success";
  const facultyLabel =
    facultyNameById(allFaculty, resolveClassFacultyId(sessionClass)) ||
    resolveClassFacultyName(sessionClass) ||
    t("sessions.classes.unassigned");
  const genderConfig: Record<string, StatusBadgeConfigItem> = genderStatusBadgeConfig(t, {
    includeAny: true,
  });

  const rawAgeMin = Reflect.get(sessionClass, "ageMin");
  const rawAgeMax = Reflect.get(sessionClass, "ageMax");
  const minAge = sessionClass.minAge ?? (typeof rawAgeMin === "number" ? rawAgeMin : 5);
  const maxAge = sessionClass.maxAge ?? (typeof rawAgeMax === "number" ? rawAgeMax : 18);

  const feeCount = sessionClass.fees?.length ?? 0;

  return (
    <DirectoryEntityCard
      entity={sessionClass}
      canSelect={false}
      onView={canWrite ? onEdit : undefined}
      onEdit={canWrite ? onEdit : undefined}
      className="group p-4 flex flex-col justify-between hover:border-primary/50 transition-all"
      header={{
        displayName: sessionClass.name,
        showSelect: false,
        subtitle: (
          <p className="m-0 truncate text-xs text-muted-foreground">
            {sessionClass.room || t("sessions.classes.noRoom")}
          </p>
        ),
      }}
      viewAriaLabel={t("sessions.classes.editNamed", { name: sessionClass.name })}
      metadataSlot={
        <EntityCard.MetaGrid className="mb-3 mt-4">
          <DirectoryCardMetaTile label={t("sessions.classes.ageRange")}>
            <span className="font-semibold text-foreground">
              {t("sessions.classes.ageYears", { min: minAge, max: maxAge })}
            </span>
          </DirectoryCardMetaTile>
          <DirectoryCardMetaTile label={t("sessions.classes.form.gender")}>
            <StatusBadge status={sessionClass.gender || "mixed"} config={genderConfig} size="sm" />
          </DirectoryCardMetaTile>
        </EntityCard.MetaGrid>
      }
      actions={
        canWrite ? (
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t("sessions.classes.messageWhatsApp", { name: sessionClass.name })}
              onClick={() => onMessage?.("whatsapp", sessionClass)}
              className="min-h-11 min-w-11 rounded-lg text-success transition-colors hover:bg-muted hover:text-success"
              title={t("sessions.classes.messageWhatsApp", { name: sessionClass.name })}
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t("sessions.classes.messageSms", { name: sessionClass.name })}
              onClick={() => onMessage?.("sms", sessionClass)}
              className="min-h-11 min-w-11 rounded-lg text-info transition-colors hover:bg-muted hover:text-info"
              title={t("sessions.classes.messageSms", { name: sessionClass.name })}
            >
              <MessageSquare className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t("sessions.classes.editNamed", { name: sessionClass.name })}
              onClick={() => onEdit(sessionClass)}
              className="min-h-11 min-w-11 rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Edit2 className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t("sessions.classes.deleteNamed", { name: sessionClass.name })}
              onClick={() => onDelete(sessionClass.id)}
              className="min-h-11 min-w-11 rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        ) : null
      }
    >
      <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
        <Users className="h-3.5 w-3.5" aria-hidden="true" />
        <span>
          {t("nav.faculty")}: <span className="font-medium text-foreground">{facultyLabel}</span>
        </span>
      </div>

      <div className="mb-3 flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          <DollarSign className="h-3 w-3" />
          {feeCount > 0 ? `${feeCount} Fees` : "No Fees set"}
        </span>
        <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          <Clock className="h-3 w-3" />
          {sessionClass.timetables?.[0]?.periods?.length ?? 0} Periods
        </span>
        {sessionClass.scholarships && sessionClass.scholarships.length > 0 && (
          <span className="inline-flex items-center gap-1 rounded-md bg-secondary/10 text-secondary px-2 py-0.5 text-xs font-medium">
            Scholarship: {sessionClass.scholarships[0]?.percentage}%
          </span>
        )}
      </div>

      {/*
        Capacity figures must reach assistive tech as TEXT. The bar stays aria-hidden
        so the same number is not announced twice.
      */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {t("sessions.classes.form.capacity")}
          </span>
          <span className="text-xs font-semibold text-foreground">
            {enrolledCount}/{maxCapacity}
          </span>
        </div>
        <ProgressBar
          value={Math.min(capacityPercent, 100)}
          fillClassName={barColor}
          trackClassName="bg-border"
          aria-hidden="true"
        />
      </div>
    </DirectoryEntityCard>
  );
}
