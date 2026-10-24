import { MODULE_METRICS_DEFAULT_PERIOD_DAYS } from "./moduleCommandMetricsCore.js";

type StatusRecord = { status?: string };

export interface SessionsCommandMetricsSnapshot {
  total: number;
  active: number;
  upcoming: number;
  completed: number;
  cancelled: number;
  totalEnrolled: number;
  totalCapacity: number;
  totalClasses: number;
  sessionsThisWeek: number;
  sessionsLastWeek: number;
}

type SessionClassMetric = { enrolled?: number; capacity?: number };
type SessionMetricRecord = StatusRecord & {
  classes?: SessionClassMetric[];
  startDate?: string;
  createdAt?: string;
};

export function computeSessionsCommandMetrics(
  sessions: SessionMetricRecord[],
): SessionsCommandMetricsSnapshot {
  const thisWeekStart = new Date();
  thisWeekStart.setHours(0, 0, 0, 0);
  thisWeekStart.setDate(thisWeekStart.getDate() - 6);
  const thisWeekStartTime = thisWeekStart.getTime();

  const thisWeekEnd = new Date();
  thisWeekEnd.setHours(23, 59, 59, 999);
  const thisWeekEndTime = thisWeekEnd.getTime();

  const lastWeekStart = new Date();
  lastWeekStart.setHours(0, 0, 0, 0);
  lastWeekStart.setDate(lastWeekStart.getDate() - 13);
  const lastWeekStartTime = lastWeekStart.getTime();

  const lastWeekEnd = new Date();
  lastWeekEnd.setHours(23, 59, 59, 999);
  lastWeekEnd.setDate(lastWeekEnd.getDate() - 7);
  const lastWeekEndTime = lastWeekEnd.getTime();

  let active = 0;
  let upcoming = 0;
  let completed = 0;
  let cancelled = 0;
  let totalEnrolled = 0;
  let totalCapacity = 0;
  let totalClasses = 0;
  let sessionsThisWeek = 0;
  let sessionsLastWeek = 0;

  for (let i = 0; i < sessions.length; i++) {
    const session = sessions[i];
    const status = session.status;
    if (status === "active") active++;
    else if (status === "upcoming") upcoming++;
    else if (status === "completed") completed++;
    else if (status === "cancelled") cancelled++;

    const classes = session.classes;
    if (classes) {
      totalClasses += classes.length;
      for (let j = 0; j < classes.length; j++) {
        const cls = classes[j];
        if (cls.enrolled) totalEnrolled += cls.enrolled;
        if (cls.capacity) totalCapacity += cls.capacity;
      }
    }

    const raw = session.startDate ?? session.createdAt;
    if (raw) {
      const time = new Date(raw).getTime();
      if (!Number.isNaN(time)) {
        if (time >= thisWeekStartTime && time <= thisWeekEndTime) {
          sessionsThisWeek++;
        }
        if (time >= lastWeekStartTime && time <= lastWeekEndTime) {
          sessionsLastWeek++;
        }
      }
    }
  }

  return {
    total: sessions.length,
    active,
    upcoming,
    completed,
    cancelled,
    totalEnrolled,
    totalCapacity,
    totalClasses,
    sessionsThisWeek,
    sessionsLastWeek,
  };
}

export interface EnrollmentsCommandMetricsSnapshot {
  total: number;
  confirmed: number;
  pending: number;
  cancelled: number;
  completed: number;
  revenue: number;
  newThisPeriod: number;
}

type EnrollmentMetricRecord = StatusRecord & { finalFee?: number; enrolledDate?: string };

export function computeEnrollmentsCommandMetrics(
  enrollments: EnrollmentMetricRecord[],
  periodDays: number = MODULE_METRICS_DEFAULT_PERIOD_DAYS,
): EnrollmentsCommandMetricsSnapshot {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - periodDays);
  const cutoffTime = cutoff.getTime();

  let confirmed = 0;
  let pending = 0;
  let cancelled = 0;
  let completed = 0;
  let revenue = 0;
  let newThisPeriod = 0;

  for (let i = 0; i < enrollments.length; i++) {
    const record = enrollments[i];
    const status = record.status;
    if (status === "confirmed") confirmed++;
    else if (status === "pending") pending++;
    else if (status === "cancelled") cancelled++;
    else if (status === "completed") completed++;

    if (status !== "cancelled" && record.finalFee) {
      revenue += record.finalFee;
    }

    const raw = record.enrolledDate;
    if (raw) {
      const time = new Date(raw).getTime();
      if (!Number.isNaN(time) && time >= cutoffTime) {
        newThisPeriod++;
      }
    }
  }

  return {
    total: enrollments.length,
    confirmed,
    pending,
    cancelled,
    completed,
    revenue,
    newThisPeriod,
  };
}

export interface AttendanceCommandMetricsSnapshot {
  total: number;
  selectedDatePresent: number;
  selectedDateAbsent: number;
  selectedDateLate: number;
  selectedDateExcused: number;
  periodTotal: number;
  selectedDatePresentRate: number;
  priorDatePresentRate: number;
  overallPresentRate: number;
}

export interface ExaminationsCommandMetricsSnapshot {
  total: number;
  upcoming: number;
  ongoing: number;
  completed: number;
  scheduled: number;
  cancelled: number;
  totalResults: number;
  examsWithResults: number;
  passRate: number;
}

export interface QuestionBankCommandMetricsSnapshot {
  total: number;
  easy: number;
  medium: number;
  hard: number;
  totalTests: number;
  totalResults: number;
  categories: number;
}
