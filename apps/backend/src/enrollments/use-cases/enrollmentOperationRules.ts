import {
  remainingSeats,
  type Enrollment,
  type EnrollmentPlacement,
  type Session,
} from "@mms/shared";

type SessionClass = NonNullable<Session["classes"]>[number];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Why `effectiveOn` is not allowed for an operation on this enrollment, or null when it is.
 * Operations take effect on or after the current placement's start and never in the future
 * (future-dated operations come with scheduled changes).
 */
export function operationWindowError(
  enrollment: Pick<Enrollment, "startOn" | "enrolledDate">,
  placements: readonly EnrollmentPlacement[],
  effectiveOn: string,
  today: string,
): string | null {
  if (effectiveOn > today) return "The effective date cannot be in the future";
  const open = placements.find((placement) => placement.endOn === null);
  const startCandidates = [open?.startOn, enrollment.startOn, enrollment.enrolledDate];
  const start = startCandidates.find((value) => value && ISO_DATE.test(value));
  if (start && effectiveOn < start)
    return `The effective date must be on or after ${start}, when the current placement began`;
  return null;
}

export type TransferTarget =
  { cls: SessionClass; sectionId: string | null; seatsLeft: number | null } | { error: string };

/**
 * Resolves and validates the destination of a transfer within the enrollment's own session.
 * Without an explicit section, the first active section of the class is used.
 */
export function findTransferTarget(
  session: Pick<Session, "classes">,
  enrollment: Pick<Enrollment, "classId" | "sectionId">,
  classId: string,
  sectionId: string | null,
  options: { allowSamePlacement?: boolean } = {},
): TransferTarget {
  const cls = (session.classes ?? []).find((row) => row.id === classId);
  if (!cls) return { error: "The class is not part of this enrollment's session" };
  const activeSections = (cls.sections ?? []).filter((section) => section.status === "active");
  const section = sectionId
    ? activeSections.find((row) => row.id === sectionId)
    : activeSections[0];
  if (sectionId && !section) return { error: "The section is not an active section of the class" };
  const resolvedSectionId = section?.id ?? null;
  if (
    !options.allowSamePlacement &&
    cls.id === enrollment.classId &&
    resolvedSectionId === (enrollment.sectionId ?? null)
  )
    return { error: "The student is already in this class and section" };
  const seatsLeft = section ? remainingSeats({ sections: [section] }) : remainingSeats(cls);
  return { cls, sectionId: resolvedSectionId, seatsLeft };
}

/** Why `effectiveOn` cannot re-admit this withdrawn enrollment, or null when it can. */
export function readmitWindowError(
  enrollment: Pick<Enrollment, "endOn">,
  effectiveOn: string,
  today: string,
): string | null {
  if (effectiveOn > today) return "The effective date cannot be in the future";
  if (enrollment.endOn && effectiveOn <= enrollment.endOn)
    return `Re-admission must start after the last day (${enrollment.endOn})`;
  return null;
}
