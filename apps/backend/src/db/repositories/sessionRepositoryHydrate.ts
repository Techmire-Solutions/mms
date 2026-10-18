import { and, eq, inArray, sql } from 'drizzle-orm';
import { type Session } from '@mms/shared';
import {
  type sessions,
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
} from '../schema.js';
import { type TenantTransaction } from '../tenant-context.js';
import { sessionRowToRecord } from './sessionRepositoryMappers.js';

export {
  listSessionsByWorkspace,
  findSessionById,
  findSessionsByIds,
  findSessionsSummaryByIds,
  findClassesByIds,
  findClassById,
} from './sessionRepositoryQueries.js';

type Transaction = TenantTransaction;

export type SessionRow = typeof sessions.$inferSelect;
type SessionFacultyRow = typeof sessionFaculty.$inferSelect;
type ClassRow = typeof sessionClasses.$inferSelect;
type FeeRow = typeof sessionClassFees.$inferSelect;
type ScheduleRow = typeof sessionClassSchedules.$inferSelect;
type BudgetRow = typeof sessionClassBudgets.$inferSelect;
type DiscountRow = typeof sessionClassDiscounts.$inferSelect;
type TimetableRow = typeof sessionClassTimetables.$inferSelect;
type PeriodRow = typeof sessionClassTimetablePeriods.$inferSelect;
type RefreshmentRow = typeof sessionClassRefreshments.$inferSelect;
type ScholarshipRow = typeof sessionClassScholarships.$inferSelect;
type EligibilityRow = typeof scholarshipEligibilities.$inferSelect;

export const SESSION_HYDRATION_BATCH_SIZE = 250;

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
          'enrolled', (SELECT count(*)::int FROM enrollments e WHERE e.workspace_subdomain = c.workspace_subdomain AND e.session_id = c.session_id AND e.class_id = c.id AND e.deleted_at IS NULL AND e.status <> 'cancelled'),
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
                  'subject', per.subject,
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
    FROM (VALUES ${sql.join(sessionIds.map((id) => sql`(${id}::text)`), sql`, `)}) AS s(id)
  `);

  const rows = (Array.isArray(queryResult) ? queryResult : ((queryResult as { rows?: unknown[] })?.rows ?? [])) as Array<{
    sessionId: unknown;
    faculty?: SessionFacultyRow[];
    classes?: Array<ClassRow & {
      fees?: FeeRow[];
      schedules?: ScheduleRow[];
      budgets?: BudgetRow[];
      discounts?: DiscountRow[];
      timetables?: Array<TimetableRow & { periods?: PeriodRow[] }>;
      refreshments?: RefreshmentRow[];
      scholarships?: Array<ScholarshipRow & { eligibility?: EligibilityRow }>;
    }>;
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

export async function hydrateSessionsList(
  tx: Transaction,
  subdomain: string,
  sessionRows: SessionRow[],
): Promise<Session[]> {
  if (sessionRows.length === 0) return [];
  if (sessionRows.length > SESSION_HYDRATION_BATCH_SIZE) {
    const results: Session[] = [];
    for (let i = 0; i < sessionRows.length; i += SESSION_HYDRATION_BATCH_SIZE) {
      const slice = sessionRows.slice(i, i + SESSION_HYDRATION_BATCH_SIZE);
      const batch = await hydrateSessionsList(tx, subdomain, slice);
      results.push(...batch);
    }
    return results;
  }

  // Attempt consolidated O(1) SQL aggregation when tx.execute is available
  if (
    process.env.MMS_DISABLE_AGGREGATED_CHILD_HYDRATION !== 'true' &&
    typeof (tx as { execute?: unknown })?.execute === 'function'
  ) {
    try {
      return await hydrateSessionsListAggregated(tx, subdomain, sessionRows);
    } catch {
      // Fallback to batched queries when execute fails (e.g., partial mock dialect)
    }
  }

  const sessionIds = sessionRows.map((s) => s.id);

  // 1. Batch load Session Faculty and Session Classes
  const [facultyRows, classesRows] = await Promise.all([
    tx
      .select({
        id: sessionFaculty.id,
        workspaceSubdomain: sessionFaculty.workspaceSubdomain,
        sessionId: sessionFaculty.sessionId,
        facultyId: sessionFaculty.facultyId,
        facultyName: sessionFaculty.facultyName,
        role: sessionFaculty.role,
        status: sessionFaculty.status,
        createdAt: sessionFaculty.createdAt,
      })
      .from(sessionFaculty)
      .where(
        and(
          eq(sessionFaculty.workspaceSubdomain, subdomain),
          inArray(sessionFaculty.sessionId, sessionIds),
        ),
      ),
    tx
      .select({
        id: sessionClasses.id,
        workspaceSubdomain: sessionClasses.workspaceSubdomain,
        sessionId: sessionClasses.sessionId,
        name: sessionClasses.name,
        gender: sessionClasses.gender,
        ageCalculationDate: sessionClasses.ageCalculationDate,
        ageMin: sessionClasses.ageMin,
        ageMax: sessionClasses.ageMax,
        capacity: sessionClasses.capacity,
        enrolled: sql<number>`(SELECT count(*)::int FROM enrollments e WHERE e.workspace_subdomain = ${sessionClasses.workspaceSubdomain} AND e.session_id = ${sessionClasses.sessionId} AND e.class_id = ${sessionClasses.id} AND e.deleted_at IS NULL AND e.status <> 'cancelled')`,
        enrollmentDeadline: sessionClasses.enrollmentDeadline,
        status: sessionClasses.status,
        facultyId: sessionClasses.facultyId,
        facultyName: sessionClasses.facultyName,
        room: sessionClasses.room,
        programId: sessionClasses.programId,
        sortOrder: sessionClasses.sortOrder,
        createdAt: sessionClasses.createdAt,
      })
      .from(sessionClasses)
      .where(
        and(
          eq(sessionClasses.workspaceSubdomain, subdomain),
          inArray(sessionClasses.sessionId, sessionIds),
        ),
      )
      .orderBy(sessionClasses.sortOrder),
  ]);

  const classIds = classesRows.map((c) => c.id);

  // If no classes exist, map sessions with faculty only
  if (classIds.length === 0) {
    const facultyMap = new Map<string, typeof facultyRows>();
    for (const f of facultyRows) {
      const list = facultyMap.get(f.sessionId) ?? [];
      list.push(f);
      facultyMap.set(f.sessionId, list);
    }
    return sessionRows.map((row) =>
      sessionRowToRecord(row, facultyMap.get(row.id) ?? [], []),
    );
  }

  // 2. Batch load Class-level children
  const [
    feeRows,
    scheduleRows,
    budgetRows,
    discountRows,
    timetableRows,
    refreshmentRows,
    scholarshipRows,
  ] = await Promise.all([
    tx
      .select({
        id: sessionClassFees.id,
        workspaceSubdomain: sessionClassFees.workspaceSubdomain,
        sessionClassId: sessionClassFees.sessionClassId,
        feeType: sessionClassFees.feeType,
        amount: sessionClassFees.amount,
        createdAt: sessionClassFees.createdAt,
      })
      .from(sessionClassFees)
      .where(
        and(
          eq(sessionClassFees.workspaceSubdomain, subdomain),
          inArray(sessionClassFees.sessionClassId, classIds),
        ),
      ),
    tx
      .select({
        id: sessionClassSchedules.id,
        workspaceSubdomain: sessionClassSchedules.workspaceSubdomain,
        sessionClassId: sessionClassSchedules.sessionClassId,
        scheduleType: sessionClassSchedules.scheduleType,
        startDate: sessionClassSchedules.startDate,
        endDate: sessionClassSchedules.endDate,
        createdAt: sessionClassSchedules.createdAt,
      })
      .from(sessionClassSchedules)
      .where(
        and(
          eq(sessionClassSchedules.workspaceSubdomain, subdomain),
          inArray(sessionClassSchedules.sessionClassId, classIds),
        ),
      ),
    tx
      .select({
        id: sessionClassBudgets.id,
        workspaceSubdomain: sessionClassBudgets.workspaceSubdomain,
        sessionClassId: sessionClassBudgets.sessionClassId,
        budgetType: sessionClassBudgets.budgetType,
        detail: sessionClassBudgets.detail,
        amount: sessionClassBudgets.amount,
        createdAt: sessionClassBudgets.createdAt,
      })
      .from(sessionClassBudgets)
      .where(
        and(
          eq(sessionClassBudgets.workspaceSubdomain, subdomain),
          inArray(sessionClassBudgets.sessionClassId, classIds),
        ),
      ),
    tx
      .select({
        id: sessionClassDiscounts.id,
        workspaceSubdomain: sessionClassDiscounts.workspaceSubdomain,
        sessionClassId: sessionClassDiscounts.sessionClassId,
        discountType: sessionClassDiscounts.discountType,
        percentage: sessionClassDiscounts.percentage,
        startDate: sessionClassDiscounts.startDate,
        endDate: sessionClassDiscounts.endDate,
        eligibilityCriteria: sessionClassDiscounts.eligibilityCriteria,
        status: sessionClassDiscounts.status,
        createdAt: sessionClassDiscounts.createdAt,
      })
      .from(sessionClassDiscounts)
      .where(
        and(
          eq(sessionClassDiscounts.workspaceSubdomain, subdomain),
          inArray(sessionClassDiscounts.sessionClassId, classIds),
        ),
      ),
    tx
      .select({
        id: sessionClassTimetables.id,
        workspaceSubdomain: sessionClassTimetables.workspaceSubdomain,
        sessionClassId: sessionClassTimetables.sessionClassId,
        date: sessionClassTimetables.date,
        createdAt: sessionClassTimetables.createdAt,
      })
      .from(sessionClassTimetables)
      .where(
        and(
          eq(sessionClassTimetables.workspaceSubdomain, subdomain),
          inArray(sessionClassTimetables.sessionClassId, classIds),
        ),
      ),
    tx
      .select({
        id: sessionClassRefreshments.id,
        workspaceSubdomain: sessionClassRefreshments.workspaceSubdomain,
        sessionClassId: sessionClassRefreshments.sessionClassId,
        date: sessionClassRefreshments.date,
        item: sessionClassRefreshments.item,
        quantity: sessionClassRefreshments.quantity,
        pricePerUnit: sessionClassRefreshments.pricePerUnit,
        paidAmount: sessionClassRefreshments.paidAmount,
        createdAt: sessionClassRefreshments.createdAt,
      })
      .from(sessionClassRefreshments)
      .where(
        and(
          eq(sessionClassRefreshments.workspaceSubdomain, subdomain),
          inArray(sessionClassRefreshments.sessionClassId, classIds),
        ),
      ),
    tx
      .select({
        id: sessionClassScholarships.id,
        workspaceSubdomain: sessionClassScholarships.workspaceSubdomain,
        sessionClassId: sessionClassScholarships.sessionClassId,
        scholarshipEligibilityId: sessionClassScholarships.scholarshipEligibilityId,
        percentage: sessionClassScholarships.percentage,
        expiryDate: sessionClassScholarships.expiryDate,
        createdAt: sessionClassScholarships.createdAt,
      })
      .from(sessionClassScholarships)
      .where(
        and(
          eq(sessionClassScholarships.workspaceSubdomain, subdomain),
          inArray(sessionClassScholarships.sessionClassId, classIds),
        ),
      ),
  ]);

  // 3. Batch load Timetable periods and Scholarship eligibilities
  const timetableIds = timetableRows.map((t) => t.id);
  const eligibilityIds = scholarshipRows
    .map((s) => s.scholarshipEligibilityId)
    .filter((id): id is string => Boolean(id));

  const [periodRows, eligibilityRows] = await Promise.all([
    timetableIds.length > 0
      ? tx
          .select({
            id: sessionClassTimetablePeriods.id,
            workspaceSubdomain: sessionClassTimetablePeriods.workspaceSubdomain,
            timetableId: sessionClassTimetablePeriods.timetableId,
            startTime: sessionClassTimetablePeriods.startTime,
            endTime: sessionClassTimetablePeriods.endTime,
            subject: sessionClassTimetablePeriods.subject,
            subjectId: sessionClassTimetablePeriods.subjectId,
            facultyId: sessionClassTimetablePeriods.facultyId,
            facultyName: sessionClassTimetablePeriods.facultyName,
            createdAt: sessionClassTimetablePeriods.createdAt,
          })
          .from(sessionClassTimetablePeriods)
          .where(
            and(
              eq(sessionClassTimetablePeriods.workspaceSubdomain, subdomain),
              inArray(sessionClassTimetablePeriods.timetableId, timetableIds),
            ),
          )
      : Promise.resolve([]),
    eligibilityIds.length > 0
      ? tx
          .select({
            id: scholarshipEligibilities.id,
            workspaceSubdomain: scholarshipEligibilities.workspaceSubdomain,
            orphan: scholarshipEligibilities.orphan,
            job: scholarshipEligibilities.job,
            business: scholarshipEligibilities.business,
            property: scholarshipEligibilities.property,
            familyMembers: scholarshipEligibilities.familyMembers,
            onJobMembers: scholarshipEligibilities.onJobMembers,
            schoolGoingSiblings: scholarshipEligibilities.schoolGoingSiblings,
            residence: scholarshipEligibilities.residence,
            notes: scholarshipEligibilities.notes,
            createdAt: scholarshipEligibilities.createdAt,
          })
          .from(scholarshipEligibilities)
          .where(
            and(
              eq(scholarshipEligibilities.workspaceSubdomain, subdomain),
              inArray(scholarshipEligibilities.id, eligibilityIds),
            ),
          )
      : Promise.resolve([]),
  ]);

  // Group by session and class
  const facultyBySession = new Map<string, typeof facultyRows>();
  for (const f of facultyRows) {
    const list = facultyBySession.get(f.sessionId) ?? [];
    list.push(f);
    facultyBySession.set(f.sessionId, list);
  }

  const classesBySession = new Map<string, typeof classesRows>();
  for (const c of classesRows) {
    const list = classesBySession.get(c.sessionId) ?? [];
    list.push(c);
    classesBySession.set(c.sessionId, list);
  }

  return sessionRows.map((row) =>
    sessionRowToRecord(
      row,
      facultyBySession.get(row.id) ?? [],
      classesBySession.get(row.id) ?? [],
      feeRows,
      scheduleRows,
      budgetRows,
      discountRows,
      timetableRows,
      periodRows,
      refreshmentRows,
      scholarshipRows,
      eligibilityRows,
    ),
  );
}

/**
 * Lean hydration for the Work list: loads `classes` & `faculty` counts for the directory cards/table.
 */
export async function hydrateSessionsListSummary(
  tx: Transaction,
  subdomain: string,
  sessionRows: SessionRow[],
): Promise<Session[]> {
  if (sessionRows.length === 0) return [];
  if (sessionRows.length > SESSION_HYDRATION_BATCH_SIZE) {
    const results: Session[] = [];
    for (let i = 0; i < sessionRows.length; i += SESSION_HYDRATION_BATCH_SIZE) {
      const slice = sessionRows.slice(i, i + SESSION_HYDRATION_BATCH_SIZE);
      const batch = await hydrateSessionsListSummary(tx, subdomain, slice);
      results.push(...batch);
    }
    return results;
  }
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
        ))
        FROM session_faculty f
        WHERE f.session_id = s.id AND f.workspace_subdomain = ${subdomain}
      ), '[]'::json) AS faculty,
      COALESCE((
        SELECT json_agg(json_build_object(
          'id', c.id,
          'sessionId', c.session_id,
          'workspaceSubdomain', c.workspace_subdomain,
          'name', c.name,
          'ageMin', c.age_min,
          'ageMax', c.age_max,
          'gender', c.gender,
          'facultyId', c.faculty_id,
          'facultyName', c.faculty_name,
          'capacity', c.capacity,
          'enrolled', (SELECT count(*)::int FROM enrollments e WHERE e.workspace_subdomain = c.workspace_subdomain AND e.session_id = c.session_id AND e.class_id = c.id AND e.deleted_at IS NULL AND e.status <> 'cancelled'),
          'room', c.room,
          'programId', c.program_id,
          'sortOrder', c.sort_order,
          'createdAt', c.created_at
        ) ORDER BY c.sort_order)
        FROM session_classes c
        WHERE c.session_id = s.id AND c.workspace_subdomain = ${subdomain}
      ), '[]'::json) AS classes
    FROM (VALUES ${sql.join(sessionIds.map((id) => sql`(${id}::text)`), sql`, `)}) AS s(id)
  `);

  const rows = (Array.isArray(queryResult) ? queryResult : ((queryResult as { rows?: unknown[] })?.rows ?? [])) as Array<{
    sessionId: unknown;
    faculty?: SessionFacultyRow[];
    classes?: ClassRow[];
  }>;
  const facultyBySession = new Map<string, SessionFacultyRow[]>();
  const classesBySession = new Map<string, ClassRow[]>();
  for (const row of rows) {
    const sid = String(row.sessionId);
    if (Array.isArray(row.faculty)) facultyBySession.set(sid, row.faculty);
    if (Array.isArray(row.classes)) classesBySession.set(sid, row.classes);
  }

  return sessionRows.map((row) =>
    sessionRowToRecord(
      row,
      facultyBySession.get(row.id) ?? [],
      classesBySession.get(row.id) ?? [],
    ),
  );
}

