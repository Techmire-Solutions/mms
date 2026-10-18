import type { Session } from './sessionTypes.js';

/** Session lifecycle: draft → open (registration) → in progress → completed; cancelled / archived are terminal. */
export const SESSION_LIFECYCLE_STATES = ['draft', 'open', 'in_progress', 'completed', 'cancelled', 'archived'] as const;
export type SessionLifecycleState = (typeof SESSION_LIFECYCLE_STATES)[number];

/** Allowed explicit transitions (auto-start `open → in_progress` runs daily on the start date). */
export const SESSION_TRANSITIONS: Readonly<Record<SessionLifecycleState, readonly SessionLifecycleState[]>> = {
  draft: ['open', 'in_progress', 'cancelled'],
  open: ['draft', 'in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: ['archived'],
  cancelled: ['archived'],
  archived: [],
};

/** States in which students may be enrolled. */
export const SESSION_ENROLLABLE_STATES: readonly SessionLifecycleState[] = ['open', 'in_progress'];

const LEGACY_STATUS: Record<string, SessionLifecycleState> = {
  active: 'in_progress',
  upcoming: 'open',
  inactive: 'archived',
};

/** Maps any stored/legacy status onto the lifecycle (unknown → draft). */
export function normalizeSessionStatus(raw: string | null | undefined): SessionLifecycleState {
  const value = (raw ?? '').trim().toLowerCase();
  if ((SESSION_LIFECYCLE_STATES as readonly string[]).includes(value)) return value as SessionLifecycleState;
  return LEGACY_STATUS[value] ?? 'draft';
}

export function canTransitionSession(from: string, to: string): boolean {
  const source = normalizeSessionStatus(from);
  const target = normalizeSessionStatus(to);
  return source === target || SESSION_TRANSITIONS[source].includes(target);
}

/** Once started, structural edits are restricted; terminal states are read-only. */
export function isSessionStructureLocked(status: string): boolean {
  return normalizeSessionStatus(status) !== 'draft' && normalizeSessionStatus(status) !== 'open';
}

export function isSessionReadOnly(status: string): boolean {
  const state = normalizeSessionStatus(status);
  return state === 'completed' || state === 'cancelled' || state === 'archived';
}

/** Edit-policy violation codes (translated by the UI as `sessions.lock.{code}`). */
export type SessionEditViolation =
  | 'readOnly'
  | 'startDate'
  | 'category'
  | 'program'
  | 'classRemoved'
  | 'sectionRemoved'
  | 'eligibility'
  | 'capacityBelowEnrolled';

/**
 * Edit policy for a started session (same rules on client and server):
 * - completed / cancelled / archived: read-only;
 * - in progress: no change to start date, category or program; no removing classes or sections;
 *   no changing a class's age/gender eligibility; no capacity below current enrollment.
 * Adding classes/sections, extending the end date, raising capacity, timetable and staff edits stay allowed.
 */
export function findSessionEditViolations(before: Session, after: Session): SessionEditViolation[] {
  if (isSessionReadOnly(before.status)) {
    return JSON.stringify(editableProjection(before)) === JSON.stringify(editableProjection(after)) ? [] : ['readOnly'];
  }
  if (!isSessionStructureLocked(before.status)) return [];

  const violations = new Set<SessionEditViolation>();
  if ((before.startDate ?? '') !== (after.startDate ?? '')) violations.add('startDate');
  if ((before.categoryId ?? '') !== (after.categoryId ?? '')) violations.add('category');
  if ((before.programId ?? '') !== (after.programId ?? '')) violations.add('program');

  const afterClasses = new Map((after.classes ?? []).map((cls) => [cls.id, cls]));
  for (const cls of before.classes ?? []) {
    const next = afterClasses.get(cls.id);
    if (!next) {
      violations.add('classRemoved');
      continue;
    }
    if (cls.gender !== next.gender || cls.minAge !== next.minAge || cls.maxAge !== next.maxAge) violations.add('eligibility');
    if (next.sections !== undefined) {
      const nextSections = new Map(next.sections.map((section) => [section.id, section]));
      for (const section of cls.sections ?? []) {
        const updated = nextSections.get(section.id);
        if (!updated) violations.add('sectionRemoved');
        else if ((updated.capacity ?? 0) < (section.enrolled ?? 0)) violations.add('capacityBelowEnrolled');
      }
    } else if ((next.maxStudents ?? 0) < (cls.enrolled ?? 0)) {
      violations.add('capacityBelowEnrolled');
    }
  }
  return [...violations];
}

/** User-editable content only (derived counters, teacher names and timestamps excluded). */
function editableProjection(session: Session) {
  return {
    name: session.name, startDate: session.startDate ?? '', endDate: session.endDate ?? '',
    categoryId: session.categoryId ?? '', programId: session.programId ?? '', baseFee: Number(session.baseFee ?? 0),
    description: session.description ?? '', workingDays: [...(session.workingDays ?? [])].sort(),
    classes: (session.classes ?? []).map((cls) => ({
      id: cls.id, name: cls.name, gender: cls.gender, minAge: cls.minAge, maxAge: cls.maxAge, programId: cls.programId ?? '',
      fees: (cls.fees ?? []).map((fee) => [fee.id, fee.feeType, Number(fee.amount)]),
      sections: (cls.sections ?? []).map((section) => [section.id, section.name, section.capacity, section.room ?? '', section.status]),
    })),
  };
}
