import type { AppTranslationKey } from "@mms/shared";
import { buildContactsReportFieldCatalog, resolveContactReportFieldLabel } from "@mms/shared";

/** Data source keys available in the custom report builder. */
export type DataSource =
  | "students"
  | "contacts"
  | "attendance"
  | "financial"
  | "academic"
  | "hasanat"
  | "sessions"
  | "faculty";

/** Map of all selectable fields grouped by data source (non-contacts legacy labels). */
export const ALL_FIELDS: Record<Exclude<DataSource, "contacts">, readonly string[]> = {
  students: [
    "Name",
    "Gender",
    "Class",
    "Session",
    "City",
    "Age",
    "Status",
    "Registration Date",
    "CNIC",
    "Discount Type",
    "Discount %",
    "Roll No",
  ],
  attendance: [
    "Student Name",
    "Class",
    "Status",
    "Present",
    "Absent",
    "Late",
    "Excused",
    "Total Days",
    "Rate %",
    "Last Marked",
  ],
  financial: [
    "Invoice ID",
    "Student Name",
    "Class",
    "Base Fee",
    "Discount",
    "Tax",
    "Final Amount",
    "Status",
    "Due Date",
    "Payment Method",
    "Issued Date",
  ],
  academic: [
    "Student Name",
    "Class",
    "Subject",
    "Marks",
    "Total",
    "Grade",
    "Rank",
    "Exam Name",
    "Date",
  ],
  hasanat: [
    "Student Name",
    "Class",
    "Faculty",
    "Distributed",
    "Redeemed",
    "Balance",
    "Reason",
    "Last Awarded",
  ],
  sessions: [
    "Session",
    "Class",
    "Type",
    "Faculty",
    "Room",
    "Time",
    "Days",
    "Enrolled",
    "Capacity",
    "Utilisation %",
    "Status",
    "Start Date",
    "End Date",
  ],
  faculty: ["Faculty Name", "Classes", "Sessions", "Total Students", "Specialization"],
};

/** Map of legacy selectable fields to translation keys. */
export const FIELD_KEY_MAP: Record<string, string> = {
  Name: "reports.fields.name",
  Gender: "reports.fields.gender",
  Class: "reports.fields.className",
  Session: "reports.fields.sessionName",
  City: "reports.fields.city",
  Age: "reports.fields.age",
  Status: "reports.fields.status",
  "Registration Date": "reports.fields.registeredDate",
  CNIC: "reports.fields.cnic",
  "Discount Type": "reports.fields.discountType",
  "Discount %": "reports.fields.discountPct",
  "Roll No": "reports.fields.rollNo",
  "Student Name": "reports.fields.studentName",
  Present: "reports.fields.present",
  Absent: "reports.fields.absent",
  Late: "reports.fields.late",
  Excused: "reports.fields.excused",
  "Total Days": "reports.fields.totalDays",
  "Rate %": "reports.fields.rate",
  "Last Marked": "reports.fields.lastMarked",
  "Invoice ID": "reports.fields.invoiceId",
  "Base Fee": "reports.fields.baseFee",
  Discount: "reports.fields.discountAmt",
  Tax: "reports.fields.tax",
  "Final Amount": "reports.fields.finalAmt",
  "Due Date": "reports.fields.dueDate",
  "Payment Method": "reports.fields.paymentMethod",
  "Issued Date": "reports.fields.issuedDate",
  Subject: "reports.fields.subject",
  Marks: "reports.fields.marks",
  Total: "reports.fields.total",
  Grade: "reports.fields.grade",
  Rank: "reports.fields.rank",
  "Exam Name": "reports.fields.examName",
  Date: "reports.fields.date",
  Faculty: "reports.fields.faculty",
  Distributed: "reports.fields.distributed",
  Redeemed: "reports.fields.redeemed",
  Balance: "reports.fields.balance",
  Reason: "reports.fields.reason",
  "Last Awarded": "reports.fields.lastAwarded",
  Type: "reports.fields.type",
  Room: "reports.fields.room",
  Time: "reports.fields.time",
  Days: "reports.fields.days",
  Enrolled: "reports.fields.enrolled",
  Capacity: "reports.fields.capacity",
  "Utilisation %": "reports.fields.utilisationPct",
  "Start Date": "reports.fields.startDate",
  "End Date": "reports.fields.endDate",
  "Faculty Name": "reports.fields.facultyName",
  Classes: "reports.fields.classes",
  Sessions: "reports.fields.sessions",
  "Total Students": "reports.fields.totalStudents",
  "Hours/Week": "reports.fields.classes",
  Specialization: "reports.fields.specialization",
};

/** Available aggregate function options. */
export const AGGREGATE_FNS = ["None", "Sum", "Average", "Count", "Max", "Min"] as const;

export type AggregateFn = (typeof AGGREGATE_FNS)[number];

/** Preview row shape - values may be missing for unmapped fields. */
export type PreviewRow = Record<string, string | number>;

type ContactFieldRegistry = Parameters<typeof resolveContactReportFieldLabel>[1];
type ContactFormTabs = Parameters<typeof buildContactsReportFieldCatalog>[1];

export function getInitialDataSource(initialSource?: string): DataSource {
  if (initialSource === "financial") return "financial";
  if (initialSource === "attendance") return "attendance";
  if (initialSource === "academic") return "academic";
  if (initialSource === "hasanat") return "hasanat";
  if (initialSource === "sessions") return "sessions";
  if (initialSource === "faculty") return "faculty";
  if (initialSource === "contacts") return "contacts";
  return "students";
}

/** Normalize legacy custom-report field ids from older saved configs. */
export function normalizeCustomReportSelectedFields(fields: readonly string[]): string[] {
  return fields.map((field) => (field === "Teacher" ? "Faculty" : field));
}

export function getInitialSelectedFields(initialSource?: string): string[] {
  if (initialSource === "contacts") return ["fullName", "gender", "city"];
  if (initialSource === "financial")
    return ["Student Name", "Class", "Base Fee", "Discount", "Final Amount", "Status"];
  if (initialSource === "attendance") return ["Student Name", "Class", "Status", "Rate %"];
  if (initialSource === "academic") return ["Student Name", "Class", "Subject", "Marks", "Grade"];
  if (initialSource === "hasanat")
    return ["Student Name", "Class", "Faculty", "Distributed", "Balance"];
  if (initialSource === "sessions") return ["Session", "Class", "Faculty", "Enrolled", "Capacity"];
  if (initialSource === "faculty") return ["Faculty Name", "Classes", "Sessions", "Total Students"];
  return ["Name", "Class", "Session", "Status"];
}

export function getSelectedFieldsForSource(source: DataSource): string[] {
  if (source === "contacts") return ["fullName", "gender", "city"];
  if (source === "financial") return ["Student Name", "Class", "Base Fee", "Final Amount"];
  if (source === "attendance") return ["Student Name", "Class", "Status", "Rate %"];
  if (source === "academic") return ["Student Name", "Class", "Subject", "Marks", "Grade"];
  if (source === "hasanat") return ["Student Name", "Class", "Distributed", "Balance"];
  if (source === "sessions") return ["Session", "Class", "Faculty", "Enrolled"];
  if (source === "faculty") return ["Faculty Name", "Classes", "Sessions", "Total Students"];
  return ["Name", "Class", "Session", "Status"];
}

export function buildCustomReportFieldCatalog(
  source: DataSource,
  selectedFields: readonly string[],
  contactsFieldCatalog: readonly { id: string }[],
): string[] {
  const selectedSet = new Set(selectedFields);
  if (source === "contacts") {
    return contactsFieldCatalog
      .map((contactField) => contactField.id)
      .filter((fieldId) => !selectedSet.has(fieldId));
  }
  return ALL_FIELDS[source].filter((fieldName) => !selectedSet.has(fieldName));
}

export function resolveCustomReportFieldLabel(
  source: DataSource,
  field: string,
  contactFields: ContactFieldRegistry,
  translate: (key: AppTranslationKey) => string,
): string {
  if (source === "contacts") {
    return resolveContactReportFieldLabel(field, contactFields, (key) =>
      translate(key as AppTranslationKey),
    );
  }
  const fieldTranslationKey = FIELD_KEY_MAP[field];
  if (fieldTranslationKey) {
    return translate(fieldTranslationKey as AppTranslationKey);
  }
  return field;
}

export function buildContactsCustomReportFieldCatalog(
  contactFields: ContactFieldRegistry,
  contactTabs: ContactFormTabs,
  viewerRole: string | undefined,
): ReturnType<typeof buildContactsReportFieldCatalog> {
  if (!viewerRole) return [];
  return buildContactsReportFieldCatalog(contactFields, contactTabs, viewerRole);
}

export function getReportDataSourceOptions(
  t: (key: AppTranslationKey) => string,
): Array<{ value: DataSource; label: string }> {
  return [
    { value: "students", label: t("reports.builder.sourceStudents") },
    { value: "contacts", label: t("contacts.reportBuilder.sourceLabel") },
    { value: "attendance", label: t("reports.builder.sourceAttendance") },
    { value: "financial", label: t("reports.builder.sourceFinancial") },
    { value: "academic", label: t("reports.builder.sourceAcademic") },
    { value: "hasanat", label: t("reports.builder.sourceHasanat") },
    { value: "sessions", label: t("reports.builder.sourceSessions") },
    { value: "faculty", label: t("reports.builder.sourceFaculty") },
  ];
}

export function getAggregateFunctionOptions(
  t: (key: AppTranslationKey) => string,
): Array<{ value: AggregateFn; label: string }> {
  return AGGREGATE_FNS.map((aggregateName) => {
    let label: string = aggregateName;
    if (aggregateName === "None") label = t("reports.builder.noGrouping");
    else if (aggregateName === "Sum") label = t("reports.visualizer.opSum");
    else if (aggregateName === "Average") label = t("reports.visualizer.opAvg");
    else if (aggregateName === "Count") label = t("reports.visualizer.opCount");
    else if (aggregateName === "Max") label = t("reports.visualizer.opMax");
    else if (aggregateName === "Min") label = t("reports.visualizer.opMin");
    return { value: aggregateName, label };
  });
}
