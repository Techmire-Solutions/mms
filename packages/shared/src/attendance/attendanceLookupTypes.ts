import { z } from "zod";

export type AttendanceStatus = {
  id: string;
  label: string;
  short: string;
  color: string;
  bg: string;
  text: string;
  border: string;
  dot: string;
};

export const DEFAULT_ATTENDANCE_STATUSES: AttendanceStatus[] = [
  {
    id: "present",
    label: "Present",
    short: "P",
    color: "emerald",
    bg: "bg-success/10",
    text: "text-success",
    border: "border-success/30",
    dot: "bg-success",
  },
  {
    id: "absent",
    label: "Absent",
    short: "A",
    color: "red",
    bg: "bg-destructive/10",
    text: "text-destructive",
    border: "border-destructive/30",
    dot: "bg-destructive",
  },
  {
    id: "late",
    label: "Late",
    short: "L",
    color: "amber",
    bg: "bg-warning/10",
    text: "text-warning",
    border: "border-warning/30",
    dot: "bg-warning",
  },
  {
    id: "excused",
    label: "Excused",
    short: "E",
    color: "blue",
    bg: "bg-info/10",
    text: "text-info",
    border: "border-info/30",
    dot: "bg-info",
  },
];

export const ATTENDANCE_LOOKUP_KINDS = ["statuses"] as const;

export type AttendanceLookupKind = (typeof ATTENDANCE_LOOKUP_KINDS)[number];

export const ATTENDANCE_LOOKUP_LEGACY_COLLECTION_KEYS = {
  attendanceStatuses: "statuses",
} as const satisfies Record<string, AttendanceLookupKind>;

export type AttendanceLookupLegacyCollectionKey =
  keyof typeof ATTENDANCE_LOOKUP_LEGACY_COLLECTION_KEYS;

export type AttendanceLookupsMap = {
  statuses: AttendanceStatus[];
};

export const defaultAttendanceLookupItems: AttendanceLookupsMap = {
  statuses: DEFAULT_ATTENDANCE_STATUSES,
};

export const emptyAttendanceLookupsMap: AttendanceLookupsMap = {
  statuses: [],
};

export const attendanceLookupKindSchema = z.enum(ATTENDANCE_LOOKUP_KINDS);

export const attendanceStatusSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  short: z.string().min(1),
  color: z.string(),
  bg: z.string(),
  text: z.string(),
  border: z.string(),
  dot: z.string(),
});

export const attendanceLookupsMapSchema = z.object({
  statuses: z.array(attendanceStatusSchema),
});

export const attendanceLookupKindParamsSchema = z.object({
  kind: attendanceLookupKindSchema,
});

export const attendanceLookupPutBodySchema = z.object({
  items: z.array(attendanceStatusSchema),
});

export function isAttendanceLookupLegacyCollectionKey(
  value: string,
): value is AttendanceLookupLegacyCollectionKey {
  return Object.prototype.hasOwnProperty.call(ATTENDANCE_LOOKUP_LEGACY_COLLECTION_KEYS, value);
}
