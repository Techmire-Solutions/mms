import { z } from "zod";

/**
 * `YYYY-MM` month bucket key used by report aggregates (attendance, finance,
 * enrollments, examinations, hasanat, obligations, questionBank, sessions).
 *
 * Shape-only by design: keys are derived server-side from real dates, so the value
 * is a bucket label rather than a user-supplied date — the regex is kept byte-identical
 * to the inline copies it replaces, so existing keys keep validating.
 */
export const monthKeySchema = z.string().regex(/^\d{4}-\d{2}$/);
