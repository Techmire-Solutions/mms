import type { ModuleColumnRegistryEntry } from "@mms/shared";
import type { StatusBadgeConfigItem } from "@/components/ui/StatusBadge";
import type { Session } from "@/lib/data/sessionsData";

export interface SessionsWorkColumnLayout {
  getColumnWidth: (key: string) => number | undefined;
  setColumnWidth: (key: string, width: number) => void;
}

export interface SessionsWorkViewProps {
  sessions: Session[];
  showDeleted: boolean;
  canDelete: boolean;
  statusConfig: Record<string, StatusBadgeConfigItem>;
  typeConfig: Record<string, StatusBadgeConfigItem>;
  isColumnVisible: (key: string) => boolean;
  columnRegistry: ModuleColumnRegistryEntry[];
  onOpenDetail: (session: Session) => void;
  onRequestDelete: (id: string) => void;
  onRestore: (id: string) => void;
}

export function getSessionEnrollmentTotals(sessionItem: Session) {
  const totalEnrolled =
    sessionItem.classes?.reduce((sum, sessionClass) => sum + (sessionClass.enrolled ?? 0), 0) ?? 0;
  const totalCapacity =
    sessionItem.classes?.reduce((sum, sessionClass) => sum + (sessionClass.maxStudents ?? 0), 0) ??
    0;
  return { totalEnrolled, totalCapacity };
}
