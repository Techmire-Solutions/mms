import type { Student } from "@/lib/data/studentsData";
import type { Faculty } from "@/lib/data/facultyData";
import type { Session } from "@/lib/data/sessionsData";
import type { Invoice } from "@/lib/data/financeData";
import type { AttendanceRecord } from "@/lib/data/attendanceData";
import type { Distribution } from "@/lib/data/hasanatData";
import type { Contact, Enrollment } from "@mms/shared";
import { QUESTION_BANK_METADATA_FIELDS } from "./reportMetadataQuestionBankFields";

export const METADATA_FIELDS = {
  students: {
    name: "Students",
    dbKey: "students",
    defaultData: [] as Student[],
    fields: [
      { value: "status", label: "Status (active/inactive)" },
      { value: "gender", label: "Gender (male/female)" },
      { value: "city", label: "City" },
      { value: "discountType", label: "Discount Type" },
      { value: "discountPct", label: "Discount Percentage", isNumeric: true },
      { value: "age", label: "Age", isNumeric: true },
      { value: "registeredDate", label: "Registration Date" },
    ],
    numericFields: [
      { value: "discountPct", label: "Discount Percentage" },
      { value: "age", label: "Age" },
    ],
  },
  faculty: {
    name: "Faculty",
    dbKey: "faculty",
    defaultData: [] as Faculty[],
    fields: [
      { value: "status", label: "Status (active/inactive/on_leave)" },
      { value: "gender", label: "Gender (male/female)" },
      { value: "specialization", label: "Specialization" },
      { value: "qualification", label: "Qualification" },
      { value: "joinDate", label: "Join Date" },
    ],
    numericFields: [],
  },
  sessions: {
    name: "Sessions & Classes",
    dbKey: "sessions",
    defaultData: [] as Session[],
    fields: [
      { value: "status", label: "Status (active/cancelled)" },
      { value: "gender", label: "Gender Orientation (male/female/any)" },
      { value: "type", label: "Course Type (Hifz/Tajweed/Qaidah...)" },
      { value: "room", label: "Classroom / Location" },
      { value: "facultyName", label: "Instructor" },
      { value: "baseFee", label: "Base Fee", isNumeric: true },
      { value: "enrolled", label: "Enrolled Count", isNumeric: true },
      { value: "capacity", label: "Capacity Limit", isNumeric: true },
      { value: "startDate", label: "Start Date" },
      { value: "endDate", label: "End Date" },
    ],
    numericFields: [
      { value: "baseFee", label: "Base Fee" },
      { value: "enrolled", label: "Enrolled Count" },
      { value: "capacity", label: "Capacity Limit" },
    ],
  },
  enrollments: {
    name: "Enrollments",
    dbKey: "enrollments",
    defaultData: [] as Enrollment[],
    fields: [
      { value: "status", label: "Status (pending/confirmed/cancelled/completed)" },
      { value: "paymentStatus", label: "Payment Status (paid/pending/none)" },
      { value: "sessionName", label: "Session Title" },
      { value: "className", label: "Class Name" },
      { value: "discountType", label: "Discount Type" },
      { value: "enrolledDate", label: "Enrolled Date" },
      { value: "finalFee", label: "Final Fee", isNumeric: true },
      { value: "baseFee", label: "Base Fee", isNumeric: true },
      { value: "discountPct", label: "Discount Percentage", isNumeric: true },
      { value: "discountAmt", label: "Discount Amount", isNumeric: true },
    ],
    numericFields: [
      { value: "finalFee", label: "Final Fee" },
      { value: "baseFee", label: "Base Fee" },
      { value: "discountPct", label: "Discount Percentage" },
      { value: "discountAmt", label: "Discount Amount" },
    ],
  },
  finance_invoices: {
    name: "Financial Invoices",
    dbKey: "finance_invoices",
    defaultData: [] as Invoice[],
    fields: [
      { value: "status", label: "Status (paid/unpaid/partial/cancelled)" },
      { value: "paymentMethod", label: "Payment Channel" },
      { value: "finalAmt", label: "Final Amount", isNumeric: true },
      { value: "paidAmt", label: "Paid Amount", isNumeric: true },
      { value: "discountAmt", label: "Discount Offset", isNumeric: true },
      { value: "baseAmt", label: "Base Fee Amount", isNumeric: true },
      { value: "dueDate", label: "Due Date" },
      { value: "paidDate", label: "Paid Date" },
    ],
    numericFields: [
      { value: "finalAmt", label: "Final Amount" },
      { value: "paidAmt", label: "Paid Amount" },
      { value: "discountAmt", label: "Discount Offset" },
      { value: "baseAmt", label: "Base Fee Amount" },
    ],
  },
  attendance_records: {
    name: "Attendance Registry",
    dbKey: "attendance_records",
    defaultData: [] as AttendanceRecord[],
    fields: [
      { value: "status", label: "Status (present/absent/late/excused)" },
      { value: "className", label: "Class Name" },
      { value: "sessionName", label: "Session Title" },
      { value: "date", label: "Attendance Date" },
    ],
    numericFields: [],
  },
  hasanat_distributions: {
    name: "Hasanat Rewards",
    dbKey: "hasanat_distributions",
    defaultData: [] as Distribution[],
    fields: [
      { value: "denominationName", label: "Reward Category (Bronze/Silver/Gold/Platinum/Diamond)" },
      { value: "quantity", label: "Quantity Distributed", isNumeric: true },
      { value: "issuedBy", label: "Faculty Grantor" },
      { value: "reason", label: "Reason For Award" },
      { value: "points", label: "Computed Points", isNumeric: true },
      { value: "issuedDate", label: "Award Date" },
    ],
    numericFields: [
      { value: "quantity", label: "Quantity Distributed" },
      { value: "points", label: "Computed Points" },
    ],
  },
  contacts: {
    name: "Contacts",
    dbKey: "contacts",
    defaultData: [] as Contact[],
    fields: [
      { value: "gender", label: "Gender (male/female)" },
      { value: "city", label: "City" },
      { value: "state", label: "State" },
      { value: "createdAt", label: "Created Date" },
      { value: "updatedAt", label: "Last Updated Date" },
    ],
    numericFields: [],
  },
  ...QUESTION_BANK_METADATA_FIELDS,
} as const;
