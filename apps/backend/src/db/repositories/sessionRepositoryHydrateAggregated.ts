import { sql } from "drizzle-orm";
import type { Session } from "@mms/shared";
import type {
  SessionReadRow,
  sessionFaculty,
  sessionClasses,
  sessionClassFees,
  sessionClassSchedules,
  sessionClassBudgets,
  sessionClassDiscounts,
  sessionClassTimetables,
  sessionClassTimetablePeriods,
  sessionClassRefreshments,
  scholarshipEligibilities,
  sessionClassScholarships,
} from "../schema.js";
import type { TenantTransaction } from "../tenant-context.js";
import { sessionRowToRecord } from "./sessionRepositoryMappers.js";
import { enrollmentHoldsSeatSql } from "./enrollmentSeatSql.js";

type Transaction = TenantTransaction;
export type SessionRow = SessionReadRow;
type SessionFacultyRow = typeof sessionFaculty.$inferSelect;
type ClassRow = typeof sessionClasses.$inferSelect;
type FeeRow = typeof sessionClassFees.$inferSelect;
type ScheduleRow = typeof sessionClassSchedules.$inferSelect;
type BudgetRow = typeof sessionClassBudgets.$inferSelect;
type DiscountRow = typeof sessionClassDiscounts.$inferSelect;
type TimetableRow = typeof sessionClassTimetables.$inferSelect;
type PeriodRow = typeof sessionClassTimetablePeriods.$inferSelect & { subject: string };
type RefreshmentRow = typeof sessionClassRefreshments.$inferSelect;
type ScholarshipRow = typeof sessionClassScholarships.$inferSelect;
type EligibilityRow = typeof scholarshipEligibilities.$inferSelect;

export async function hydrateSessionsListAggregated(
  tx: Transaction,
  subdomain: string,
  sessionRows: SessionRow[],
): Promise<Session[]> {
  if (sessionRows.length === 0) return [];
  const sessionIds = sessionRows.map((s) => s.id);

  const queryResult = await (tx as { execute: (q: unknown) => Promise<unknown> }).execute(sql`
    SELECT
      s.id AS "sessionId",
      COALESCE((
        SELECT json_agg(json_build_object(
          'id', f.id,
          'sessionId', f.session_id,
          'workspaceSubdomain', f.workspace_subdomain,
          'facultyId', f.faculty_id,
          'facultyName', f.faculty_name,
          'role', f.role,
          'status', f.status,
          'createdAt', f.created_at
        ) ORDER BY f.created_at)
        FROM session_faculty f
        WHERE f.session_id = s.id AND f.workspace_subdomain = ${subdomain}
      ), '[]'::json) AS faculty,
      COALESCE((
        SELECT json_agg(json_build_object(
          'id', c.id,
          'sessionId', c.session_id,
          'workspaceSubdomain', c.workspace_subdomain,
          'name', c.name,
          'gender', c.gender,
          'ageCalculationDate', COALESCE(c.age_calc_date::text, ''),
          'ageMin', c.age_min,
          'ageMax', c.age_max,
          'capacity', c.capacity,
          'enrolled', (SELECT count(*)::int FROM enrollments e WHERE e.workspace_subdomain = c.workspace_subdomain AND e.session_id = c.session_id AND e.class_id = c.id AND e.deleted_at IS NULL AND ${enrollmentHoldsSeatSql("e")}),
          'enrollmentDeadline', c.enrollment_deadline,
          'status', c.status,
          'facultyId', c.faculty_id,
          'facultyName', c.faculty_name,
          'room', c.room,
          'programId', c.program_id,
          'sortOrder', c.sort_order,
          'createdAt', c.created_at,
          'fees', COALESCE((
            SELECT json_agg(json_build_object(
              'id', fee.id,
              'sessionClassId', fee.session_class_id,
              'workspaceSubdomain', fee.workspace_subdomain,
              'feeType', fee.fee_type,
              'amount', fee.amount,
              'createdAt', fee.created_at
            ))
            FROM session_class_fees fee
            WHERE fee.session_class_id = c.id AND fee.workspace_subdomain = ${subdomain}
          ), '[]'::json),
          'schedules', COALESCE((
            SELECT json_agg(json_build_object(
              'id', sch.id,
              'sessionClassId', sch.session_class_id,
              'workspaceSubdomain', sch.workspace_subdomain,
              'scheduleType', sch.schedule_type,
              'startDate', COALESCE(sch.start_date::text, ''),
              'endDate', COALESCE(sch.end_date::text, ''),
              'createdAt', sch.created_at
            ))
            FROM session_class_schedules sch
            WHERE sch.session_class_id = c.id AND sch.workspace_subdomain = ${subdomain}
          ), '[]'::json),
          'budgets', COALESCE((
            SELECT json_agg(json_build_object(
              'id', bg.id,
              'sessionClassId', bg.session_class_id,
              'workspaceSubdomain', bg.workspace_subdomain,
              'budgetType', bg.budget_type,
              'detail', bg.detail,
              'amount', bg.amount,
              'createdAt', bg.created_at
            ))
            FROM session_class_budgets bg
            WHERE bg.session_class_id = c.id AND bg.workspace_subdomain = ${subdomain}
          ), '[]'::json),
          'discounts', COALESCE((
            SELECT json_agg(json_build_object(
              'id', dc.id,
              'sessionClassId', dc.session_class_id,
              'workspaceSubdomain', dc.workspace_subdomain,
              'discountType', dc.discount_type,
              'percentage', dc.percentage,
              'startDate', COALESCE(dc.start_date::text, ''),
              'endDate', COALESCE(dc.end_date::text, ''),
              'eligibilityCriteria', dc.eligibility_criteria,
              'status', dc.status,
              'createdAt', dc.created_at
            ))
            FROM session_class_discounts dc
            WHERE dc.session_class_id = c.id AND dc.workspace_subdomain = ${subdomain}
          ), '[]'::json),
          'timetables', COALESCE((
            SELECT json_agg(json_build_object(
              'id', tt.id,
              'sessionClassId', tt.session_class_id,
              'workspaceSubdomain', tt.workspace_subdomain,
              'date', COALESCE(tt.date::text, ''),
              'createdAt', tt.created_at,
              'periods', COALESCE((
                SELECT json_agg(json_build_object(
                  'id', per.id,
                  'timetableId', per.timetable_id,
                  'workspaceSubdomain', per.workspace_subdomain,
                  'startTime', per.start_time,
                  'endTime', per.end_time,
                  'subject', COALESCE((SELECT j.name FROM subjects j
                    WHERE j.workspace_subdomain = per.workspace_subdomain AND j.id = per.subject_id), ''),
                  'subjectId', per.subject_id,
                  'facultyId', per.faculty_id,
                  'facultyName', per.faculty_name,
                  'createdAt', per.created_at
                ))
                FROM session_class_timetable_periods per
                WHERE per.timetable_id = tt.id AND per.workspace_subdomain = ${subdomain}
              ), '[]'::json)
            ))
            FROM session_class_timetables tt
            WHERE tt.session_class_id = c.id AND tt.workspace_subdomain = ${subdomain}
          ), '[]'::json),
          'refreshments', COALESCE((
            SELECT json_agg(json_build_object(
              'id', ref.id,
              'sessionClassId', ref.session_class_id,
              'workspaceSubdomain', ref.workspace_subdomain,
              'date', COALESCE(ref.date::text, ''),
              'item', ref.item,
              'quantity', ref.quantity,
              'pricePerUnit', ref.price_per_unit,
              'paidAmount', ref.paid_amount,
              'createdAt', ref.created_at
            ))
            FROM session_class_refreshments ref
            WHERE ref.session_class_id = c.id AND ref.workspace_subdomain = ${subdomain}
          ), '[]'::json),
          'scholarships', COALESCE((
            SELECT json_agg(json_build_object(
              'id', sc.id,
              'sessionClassId', sc.session_class_id,
              'workspaceSubdomain', sc.workspace_subdomain,
              'scholarshipEligibilityId', sc.scholarship_eligibility_id,
              'percentage', sc.percentage,
              'expiryDate', COALESCE(sc.expiry_date::text, ''),
              'createdAt', sc.created_at,
              'eligibility', (
                SELECT json_build_object(
                  'id', se.id,
                  'orphan', se.orphan,
                  'job', se.job,
                  'business', se.business,
                  'property', se.property,
                  'familyMembers', se.family_members,
                  'onJobMembers', se.on_job_members,
                  'schoolGoingSiblings', se.school_going_siblings,
                  'residence', se.residence,
                  'notes', se.notes
                )
                FROM scholarship_eligibilities se
                WHERE se.id = sc.scholarship_eligibility_id AND se.workspace_subdomain = ${subdomain}
              )
            ))
            FROM session_class_scholarships sc
            WHERE sc.session_class_id = c.id AND sc.workspace_subdomain = ${subdomain}
          ), '[]'::json)
        ) ORDER BY c.sort_order)
        FROM session_classes c
        WHERE c.session_id = s.id AND c.workspace_subdomain = ${subdomain}
      ), '[]'::json) AS classes
    FROM (VALUES ${sql.join(
      sessionIds.map((id) => sql`(${id}::text)`),
      sql`, `,
    )}) AS s(id)
  `);

  const rows = (
    Array.isArray(queryResult) ? queryResult : ((queryResult as { rows?: unknown[] })?.rows ?? [])
  ) as Array<{
    sessionId: unknown;
    faculty?: SessionFacultyRow[];
    classes?: Array<
      ClassRow & {
        fees?: FeeRow[];
        schedules?: ScheduleRow[];
        budgets?: BudgetRow[];
        discounts?: DiscountRow[];
        timetables?: Array<TimetableRow & { periods?: PeriodRow[] }>;
        refreshments?: RefreshmentRow[];
        scholarships?: Array<ScholarshipRow & { eligibility?: EligibilityRow }>;
      }
    >;
  }>;
  const facultyBySession = new Map<string, SessionFacultyRow[]>();
  const classesBySession = new Map<string, ClassRow[]>();
  const feesRows: FeeRow[] = [];
  const schedulesRows: ScheduleRow[] = [];
  const budgetsRows: BudgetRow[] = [];
  const discountsRows: DiscountRow[] = [];
  const timetablesRows: TimetableRow[] = [];
  const periodsRows: PeriodRow[] = [];
  const refreshmentsRows: RefreshmentRow[] = [];
  const scholarshipsRows: ScholarshipRow[] = [];
  const eligibilitiesRows: EligibilityRow[] = [];

  for (const r of rows) {
    const sid = String(r.sessionId);
    if (Array.isArray(r.faculty)) {
      facultyBySession.set(sid, r.faculty);
    }
    if (Array.isArray(r.classes)) {
      classesBySession.set(sid, r.classes);
      for (const cls of r.classes) {
        if (Array.isArray(cls.fees)) feesRows.push(...cls.fees);
        if (Array.isArray(cls.schedules)) schedulesRows.push(...cls.schedules);
        if (Array.isArray(cls.budgets)) budgetsRows.push(...cls.budgets);
        if (Array.isArray(cls.discounts)) discountsRows.push(...cls.discounts);
        if (Array.isArray(cls.timetables)) {
          timetablesRows.push(...cls.timetables);
          for (const tt of cls.timetables) {
            if (Array.isArray(tt.periods)) periodsRows.push(...tt.periods);
          }
        }
        if (Array.isArray(cls.refreshments)) refreshmentsRows.push(...cls.refreshments);
        if (Array.isArray(cls.scholarships)) {
          scholarshipsRows.push(...cls.scholarships);
          for (const sc of cls.scholarships) {
            if (sc.eligibility && sc.eligibility.id) {
              eligibilitiesRows.push(sc.eligibility);
            }
          }
        }
      }
    }
  }

  return sessionRows.map((row) =>
    sessionRowToRecord(
      row,
      facultyBySession.get(row.id) ?? [],
      classesBySession.get(row.id) ?? [],
      feesRows,
      schedulesRows,
      budgetsRows,
      discountsRows,
      timetablesRows,
      periodsRows,
      refreshmentsRows,
      scholarshipsRows,
      eligibilitiesRows,
    ),
  );
}
