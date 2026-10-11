import type { ErdDomain } from "./erdCatalogTypes.js";

/** Daily marks and leave requests (Drizzle `attendance.ts`). */
export const ERD_DOMAIN_ATTENDANCE: ErdDomain = {
  id: "attendance",
  labelKey: "nav.attendance",
  tables: [
    {
      name: "attendance",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "class_id", type: "varchar(64)", kind: "fk" },
        { name: "student_id", type: "varchar(64)", kind: "fk" },
        { name: "date", type: "varchar(10)", kind: "unique" },
        { name: "status", type: "varchar(20)", kind: "column" },
      ],
    },
    {
      name: "attendance_leaves",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "student_id", type: "varchar(64)", kind: "fk" },
        { name: "from_date", type: "varchar(10)", kind: "column" },
        { name: "to_date", type: "varchar(10)", kind: "column" },
        { name: "status", type: "varchar(20)", kind: "column" },
      ],
    },
    {
      name: "students",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "contact_id", type: "text", kind: "fk" },
        { name: "gr_number", type: "varchar(100)", kind: "column" },
      ],
    },
    {
      name: "session_classes",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "session_id", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "name", type: "varchar(255)", kind: "column" },
        { name: "faculty_id", type: "varchar(64)", kind: "column" },
      ],
    },
    {
      name: "sessions",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "name", type: "varchar(255)", kind: "column" },
        { name: "status", type: "varchar(50)", kind: "column" },
      ],
    },
  ],
  relationships: [
    {
      fromTable: "attendance",
      fromColumn: "student_id",
      toTable: "students",
      toColumn: "id",
      cardinality: "N:1",
      onDelete: "cascade",
    },
    {
      fromTable: "attendance_leaves",
      fromColumn: "student_id",
      toTable: "students",
      toColumn: "id",
      cardinality: "N:1",
      onDelete: "cascade",
    },
    {
      fromTable: "attendance",
      fromColumn: "class_id",
      toTable: "session_classes",
      toColumn: "id",
      cardinality: "N:1",
    },
    {
      fromTable: "session_classes",
      fromColumn: "session_id",
      toTable: "sessions",
      toColumn: "id",
      cardinality: "N:1",
      onDelete: "cascade",
    },
  ],
};

/** Academic terms, classes, and timetable (Drizzle `sessions.ts`). */
export const ERD_DOMAIN_SESSIONS: ErdDomain = {
  id: "sessions",
  labelKey: "nav.sessions",
  tables: [
    {
      name: "sessions",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "name", type: "varchar(255)", kind: "column" },
        { name: "status", type: "varchar(50)", kind: "column" },
        { name: "base_fee", type: "numeric(12,2)", kind: "column" },
      ],
    },
    {
      name: "session_classes",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "session_id", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "name", type: "varchar(255)", kind: "column" },
        { name: "faculty_id", type: "varchar(64)", kind: "column" },
      ],
    },
    {
      name: "session_timetable",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "session_id", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "day", type: "varchar(10)", kind: "column" },
        { name: "start_time", type: "varchar(20)", kind: "column" },
      ],
    },
    {
      name: "session_discounts",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "session_id", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "name", type: "varchar(255)", kind: "column" },
        { name: "value", type: "numeric(10,2)", kind: "column" },
      ],
    },
    {
      name: "session_faculty",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "session_id", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "faculty_id", type: "varchar(64)", kind: "column" },
        { name: "faculty_name", type: "varchar(255)", kind: "column" },
        { name: "role", type: "varchar(100)", kind: "column" },
        { name: "status", type: "varchar(50)", kind: "column" },
      ],
    },
  ],
  relationships: [
    {
      fromTable: "session_classes",
      fromColumn: "session_id",
      toTable: "sessions",
      toColumn: "id",
      cardinality: "N:1",
      onDelete: "cascade",
    },
    {
      fromTable: "session_faculty",
      fromColumn: "session_id",
      toTable: "sessions",
      toColumn: "id",
      cardinality: "N:1",
      onDelete: "cascade",
    },
    {
      fromTable: "session_timetable",
      fromColumn: "session_id",
      toTable: "sessions",
      toColumn: "id",
      cardinality: "N:1",
      onDelete: "cascade",
    },
    {
      fromTable: "session_discounts",
      fromColumn: "session_id",
      toTable: "sessions",
      toColumn: "id",
      cardinality: "N:1",
      onDelete: "cascade",
    },
  ],
};

/** Class placements linking students to sessions (Drizzle `enrollments.ts`). */
export const ERD_DOMAIN_ENROLLMENTS: ErdDomain = {
  id: "enrollments",
  labelKey: "nav.enrollments",
  tables: [
    {
      name: "enrollments",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "student_id", type: "varchar(64)", kind: "fk" },
        { name: "session_id", type: "varchar(64)", kind: "fk" },
        { name: "class_id", type: "varchar(64)", kind: "fk" },
        { name: "status", type: "varchar(20)", kind: "column" },
      ],
    },
    {
      name: "enrollment_timeline_events",
      columns: [
        { name: "id", type: "bigint", kind: "pk" },
        { name: "workspace_subdomain", type: "text", kind: "fk" },
        { name: "enrollment_id", type: "text", kind: "fk" },
        { name: "event", type: "varchar(120)", kind: "column" },
      ],
    },
    {
      name: "students",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "gr_number", type: "varchar(100)", kind: "column" },
      ],
    },
    {
      name: "sessions",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "name", type: "varchar(255)", kind: "column" },
      ],
    },
    {
      name: "session_classes",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "session_id", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "name", type: "varchar(255)", kind: "column" },
      ],
    },
  ],
  relationships: [
    {
      fromTable: "enrollments",
      fromColumn: "student_id",
      toTable: "students",
      toColumn: "id",
      cardinality: "N:1",
      onDelete: "cascade",
    },
    {
      fromTable: "enrollments",
      fromColumn: "session_id",
      toTable: "sessions",
      toColumn: "id",
      cardinality: "N:1",
      onDelete: "cascade",
    },
    {
      fromTable: "enrollments",
      fromColumn: "class_id",
      toTable: "session_classes",
      toColumn: "id",
      cardinality: "N:1",
    },
    {
      fromTable: "enrollment_timeline_events",
      fromColumn: "enrollment_id",
      toTable: "enrollments",
      toColumn: "id",
      cardinality: "N:1",
    },
  ],
};
