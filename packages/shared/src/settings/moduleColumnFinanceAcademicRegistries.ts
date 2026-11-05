import {
  createColumnRegistry,
  type ModuleColumnKind,
  type ModuleColumnRegistryEntry,
} from "./moduleColumnCore.js";

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

const FINANCE_INVOICE_COLUMN_KINDS: Readonly<Record<string, ModuleColumnKind>> = {
  invoice: "reference",
  student: "person",
  sessionClass: "shortText",
  baseFee: "money",
  discount: "money",
  final: "money",
  status: "status",
  dueDate: "date",
};

/** Builds tenant-default Work column registry for Finance invoices (before per-user overlay). */
export function buildFinanceInvoiceWorkColumnRegistry(
  labels: FinanceInvoiceWorkColumnLabels,
): ModuleColumnRegistryEntry[] {
  return createColumnRegistry(
    ["invoice", "student", "sessionClass", "baseFee", "discount", "final", "status", "dueDate"],
    labels,
    true,
    FINANCE_INVOICE_COLUMN_KINDS,
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

const FINANCE_PAYMENT_COLUMN_KINDS: Readonly<Record<string, ModuleColumnKind>> = {
  date: "date",
  student: "person",
  invoice: "reference",
  amount: "money",
  method: "status",
  receivedBy: "person",
  note: "longText",
};

/** Builds tenant-default Work column registry for Finance payments (before per-user overlay). */
export function buildFinancePaymentWorkColumnRegistry(
  labels: FinancePaymentWorkColumnLabels,
): ModuleColumnRegistryEntry[] {
  return createColumnRegistry(
    ["date", "student", "invoice", "amount", "method", "receivedBy", "note"],
    labels,
    true,
    FINANCE_PAYMENT_COLUMN_KINDS,
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

const ATTENDANCE_COLUMN_KINDS: Readonly<Record<string, ModuleColumnKind>> = {
  date: "date",
  class: "shortText",
  session: "shortText",
  student: "person",
  status: "status",
  timeIn: "code",
  timeOut: "code",
  notes: "longText",
};

/** Builds tenant-default Work column registry for Attendance records (before per-user overlay). */
export function buildAttendanceWorkColumnRegistry(
  labels: AttendanceWorkColumnLabels,
): ModuleColumnRegistryEntry[] {
  return createColumnRegistry(
    ["date", "class", "session", "student", "status", "timeIn", "timeOut", "notes"],
    labels,
    true,
    ATTENDANCE_COLUMN_KINDS,
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

const SESSION_COLUMN_KINDS: Readonly<Record<string, ModuleColumnKind>> = {
  name: "title",
  type: "status",
  startDate: "date",
  endDate: "date",
  duration: "number",
  fee: "money",
  currency: "code",
  enrolled: "number",
  status: "status",
  description: "longText",
};

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
    true,
    SESSION_COLUMN_KINDS,
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

const ENROLLMENT_COLUMN_KINDS: Readonly<Record<string, ModuleColumnKind>> = {
  student: "person",
  session: "shortText",
  class: "shortText",
  enrolledDate: "date",
  finalFee: "money",
  status: "status",
  payment: "status",
  notes: "longText",
};

/** Builds tenant-default Work column registry for Enrollments (before per-user overlay). */
export function buildEnrollmentWorkColumnRegistry(
  labels: EnrollmentWorkColumnLabels,
): ModuleColumnRegistryEntry[] {
  return createColumnRegistry(
    ["student", "session", "class", "enrolledDate", "finalFee", "status", "payment", "notes"],
    labels,
    true,
    ENROLLMENT_COLUMN_KINDS,
  );
}
