import { createColumnRegistry, type ModuleColumnRegistryEntry } from "./moduleColumnCore.js";

export interface FinanceInvoiceWorkColumnLabels {
  invoice: string;
  student: string;
  sessionClass: string;
  baseFee: string;
  discount: string;
  final: string;
  status: string;
  dueDate: string;
}

/** Builds tenant-default Work column registry for Finance invoices (before per-user overlay). */
export function buildFinanceInvoiceWorkColumnRegistry(
  labels: FinanceInvoiceWorkColumnLabels,
): ModuleColumnRegistryEntry[] {
  return createColumnRegistry(
    ["invoice", "student", "sessionClass", "baseFee", "discount", "final", "status", "dueDate"],
    labels,
  );
}

export interface FinancePaymentWorkColumnLabels {
  date: string;
  student: string;
  invoice: string;
  amount: string;
  method: string;
  receivedBy: string;
  note: string;
}

/** Builds tenant-default Work column registry for Finance payments (before per-user overlay). */
export function buildFinancePaymentWorkColumnRegistry(
  labels: FinancePaymentWorkColumnLabels,
): ModuleColumnRegistryEntry[] {
  return createColumnRegistry(
    ["date", "student", "invoice", "amount", "method", "receivedBy", "note"],
    labels,
  );
}

export interface AttendanceWorkColumnLabels {
  date: string;
  class: string;
  session: string;
  student: string;
  status: string;
  timeIn: string;
  timeOut: string;
  notes: string;
}

/** Builds tenant-default Work column registry for Attendance records (before per-user overlay). */
export function buildAttendanceWorkColumnRegistry(
  labels: AttendanceWorkColumnLabels,
): ModuleColumnRegistryEntry[] {
  return createColumnRegistry(
    ["date", "class", "session", "student", "status", "timeIn", "timeOut", "notes"],
    labels,
  );
}

export interface SessionWorkColumnLabels {
  name: string;
  type: string;
  startDate: string;
  endDate: string;
  duration: string;
  fee: string;
  currency: string;
  enrolled: string;
  status: string;
  description: string;
}

/** Builds tenant-default Work column registry for Sessions list view (before per-user overlay). */
export function buildSessionWorkColumnRegistry(
  labels: SessionWorkColumnLabels,
): ModuleColumnRegistryEntry[] {
  return createColumnRegistry(
    [
      "name",
      "type",
      "startDate",
      "endDate",
      "duration",
      "fee",
      "currency",
      "enrolled",
      "status",
      "description",
    ],
    labels,
  );
}

export interface EnrollmentWorkColumnLabels {
  student: string;
  session: string;
  class: string;
  enrolledDate: string;
  finalFee: string;
  status: string;
  payment: string;
  notes: string;
}

/** Builds tenant-default Work column registry for Enrollments (before per-user overlay). */
export function buildEnrollmentWorkColumnRegistry(
  labels: EnrollmentWorkColumnLabels,
): ModuleColumnRegistryEntry[] {
  return createColumnRegistry(
    ["student", "session", "class", "enrolledDate", "finalFee", "status", "payment", "notes"],
    labels,
  );
}
