import {
  evaluateEligibility,
  promotionOutcomeFor,
  type PromotionOutcome,
  type PromotionPreviewRow,
  type Session,
  type SessionRolloverBody,
} from "@mms/shared";

export interface RolloverPlanCandidate {
  id: string;
  studentName: string;
  classId: string;
  sectionId: string | null;
  student: { dob?: string; gender?: string } | null;
}

export interface RolloverPlanRow extends PromotionPreviewRow {
  /** Source section the student sat in (retained students keep its copy). */
  fromSectionId: string | null;
}

/**
 * Outcome, destination and eligibility problems per live source enrollment. Eligibility is
 * checked against the destination class's rules on the new session's first day.
 */
export function planRollover(
  source: Session,
  body: Pick<SessionRolloverBody, "target" | "classMap" | "outcomes">,
  candidates: readonly RolloverPlanCandidate[],
): RolloverPlanRow[] {
  const overrides = new Map<string, PromotionOutcome>(
    body.outcomes.map((row) => [row.enrollmentId, row.outcome]),
  );
  const classes = new Map(source.classes.map((cls) => [cls.id, cls]));
  return candidates.map((candidate) => {
    const { outcome, toSourceClassId } = promotionOutcomeFor(candidate, body.classMap, overrides);
    const problems: string[] = [];
    const cls = toSourceClassId ? classes.get(toSourceClassId) : undefined;
    if ((outcome === "promote" || outcome === "retain") && !cls) problems.push("no_target_class");
    if (cls) {
      const result = evaluateEligibility({
        applicant: { dateOfBirth: candidate.student?.dob, gender: candidate.student?.gender },
        cls: {
          gender: cls.gender,
          minAge: cls.minAge,
          maxAge: cls.maxAge,
          ageCalculationDate: null,
        },
        session: { status: "open", startDate: body.target.startDate },
        asOf: body.target.startDate,
      });
      problems.push(...result.reasons);
    }
    return {
      enrollmentId: candidate.id,
      studentName: candidate.studentName,
      fromClassId: candidate.classId,
      fromSectionId: candidate.sectionId,
      outcome,
      toClassId: cls ? cls.id : null,
      problems,
    };
  });
}

/** Section in the target class: the copy of the same section, else one with the same name. */
export function rolloverTargetSection(
  row: Pick<RolloverPlanRow, "fromSectionId">,
  source: Session,
  target: Session,
  targetClassId: string,
  sectionIds: ReadonlyMap<string, string>,
): string | null {
  const targetClass = target.classes.find((cls) => cls.id === targetClassId);
  const sections = targetClass?.sections ?? [];
  const copied = row.fromSectionId ? sectionIds.get(row.fromSectionId) : undefined;
  if (copied && sections.some((section) => section.id === copied)) return copied;
  const name = source.classes
    .flatMap((cls) => cls.sections ?? [])
    .find((section) => section.id === row.fromSectionId)?.name;
  return sections.find((section) => section.name === name)?.id ?? null;
}
