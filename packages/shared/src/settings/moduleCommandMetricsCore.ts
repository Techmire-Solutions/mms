import { resolveFacultyStatusRoles, FACULTY_STATUS_VALUES } from "../faculty/facultyTypes.js";

/** Default rolling window for "new records" command-centre metrics (globle1 §2.1). */
export const MODULE_METRICS_DEFAULT_PERIOD_DAYS = 30;

export interface StudentsCommandMetricsSnapshot {
  total: number;
  active: number;
  inactive: number;
  suspended: number;
  newThisPeriod: number;
}

export interface FacultyCommandMetricsSnapshot {
  total: number;
  active: number;
  inactive: number;
  onLeave: number;
  /** Active rows whose status is outside {@link FACULTY_STATUS_VALUES}. */
  other: number;
  newThisPeriod: number;
}

export interface FinanceCommandMetricsSnapshot {
  totalInvoices: number;
  outstanding: number;
  overdue: number;
  paid: number;
  partial: number;
  totalPayments: number;
  collectedTotal: number;
  outstandingBalance: number;
  discountTotal: number;
  collectedThisMonth: number;
  collectedPrevMonth: number;
  outstandingThisMonth: number;
  outstandingPrevMonth: number;
}

export interface UsersCommandMetricsSnapshot {
  total: number;
  active: number;
  suspended: number;
  admins: number;
  twoFaEnabled: number;
  activeSessions: number;
}

type StatusRecord = { status?: string };
type RegisteredRecord = StatusRecord & { registeredDate?: string; createdAt?: string };
type JoinDateRecord = StatusRecord & {
  employmentStartDate?: string | null;
  /** @deprecated legacy alias of `employmentStartDate` */
  joinDate?: string;
  createdAt?: string;
};
type WorkspaceUserMetricRecord = StatusRecord & {
  role?: string;
  twoFactorEnabled?: boolean;
  activeSessions?: number;
};

export function countRecordsWithStatus<T>(
  records: T[],
  status: string,
  getStatus: (record: T) => string | undefined = (record) => (record as StatusRecord).status,
): number {
  let count = 0;
  for (let i = 0; i < records.length; i++) {
    if (getStatus(records[i]) === status) count++;
  }
  return count;
}

export function countRecordsSinceDate<T>(
  records: T[],
  getDate: (record: T) => string | undefined,
  periodDays: number = MODULE_METRICS_DEFAULT_PERIOD_DAYS,
): number {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - periodDays);
  const cutoffTime = cutoff.getTime();
  let count = 0;
  for (let i = 0; i < records.length; i++) {
    const raw = getDate(records[i]);
    if (!raw) continue;
    const time = new Date(raw).getTime();
    if (!Number.isNaN(time) && time >= cutoffTime) {
      count++;
    }
  }
  return count;
}

export function computeStudentsCommandMetrics(
  students: RegisteredRecord[],
  periodDays: number = MODULE_METRICS_DEFAULT_PERIOD_DAYS,
): StudentsCommandMetricsSnapshot {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - periodDays);
  const cutoffTime = cutoff.getTime();

  let active = 0,
    inactive = 0,
    suspended = 0,
    newThisPeriod = 0;

  for (let i = 0; i < students.length; i++) {
    const s = students[i];
    if (s.status === "active") active++;
    else if (s.status === "inactive") inactive++;
    else if (s.status === "suspended") suspended++;

    const raw = s.registeredDate ?? s.createdAt;
    if (raw) {
      const time = new Date(raw).getTime();
      if (!Number.isNaN(time) && time >= cutoffTime) {
        newThisPeriod++;
      }
    }
  }

  return {
    total: students.length,
    active,
    inactive,
    suspended,
    newThisPeriod,
  };
}

/**
 * Prefer SQL `aggregateFacultyCommandMetrics` / `loadFacultyCommandMetrics`.
 * Kept for pure unit tests of status / joinDate period predicates.
 */
export function computeFacultyCommandMetrics(
  faculty: JoinDateRecord[],
  periodDays: number = MODULE_METRICS_DEFAULT_PERIOD_DAYS,
): FacultyCommandMetricsSnapshot {
  const {
    active: activeStatus,
    inactive: inactiveStatus,
    onLeave: onLeaveStatus,
  } = resolveFacultyStatusRoles();
  const knownStatuses = new Set<string>(FACULTY_STATUS_VALUES);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - periodDays);
  const cutoffTime = cutoff.getTime();

  let active = 0,
    inactive = 0,
    onLeave = 0,
    other = 0,
    newThisPeriod = 0;

  for (let i = 0; i < faculty.length; i++) {
    const member = faculty[i];
    const status = member.status;
    if (status === activeStatus) active++;
    else if (status === inactiveStatus) inactive++;
    else if (status === onLeaveStatus) onLeave++;

    const trimmed = String(status ?? "").trim();
    if (trimmed.length > 0 && !knownStatuses.has(trimmed)) {
      other++;
    }

    const raw = member.employmentStartDate ?? member.joinDate ?? member.createdAt;
    if (raw) {
      const time = new Date(raw).getTime();
      if (!Number.isNaN(time) && time >= cutoffTime) {
        newThisPeriod++;
      }
    }
  }

  return {
    total: faculty.length,
    active,
    inactive,
    onLeave,
    other,
    newThisPeriod,
  };
}

export const computeFacultyCommandMetricsSnapshot = computeFacultyCommandMetrics;

export function computeUsersCommandMetrics(
  users: WorkspaceUserMetricRecord[],
): UsersCommandMetricsSnapshot {
  let active = 0,
    suspended = 0,
    admins = 0,
    twoFaEnabled = 0,
    activeSessions = 0;

  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    if (user.status === "active") active++;
    else if (user.status === "suspended") suspended++;

    if (user.role === "admin") admins++;
    if (user.twoFactorEnabled) twoFaEnabled++;
    if (user.activeSessions) activeSessions += user.activeSessions;
  }

  return {
    total: users.length,
    active,
    suspended,
    admins,
    twoFaEnabled,
    activeSessions,
  };
}
