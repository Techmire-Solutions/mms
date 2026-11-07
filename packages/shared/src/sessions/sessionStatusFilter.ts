import { z } from "zod";
import { parseSessionStatus, type SessionStatus } from "./sessionTransitions.js";

/**
 * Comma-separated list filter for list queries. Accepts lifecycle states and legacy aliases;
 * unknown statuses are rejected at the contract boundary instead of silently matching nothing.
 */
export const sessionStatusFilterSchema = z
  .string()
  .trim()
  .max(500)
  .optional()
  .refine(
    (value) =>
      !value ||
      value
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
        .every((part) => {
          try {
            parseSessionStatus(part);
            return true;
          } catch {
            return false;
          }
        }),
    "Unknown session status in the status filter",
  );

/** Normalizes a validated comma-separated status filter to canonical lifecycle values. */
export function normalizeSessionStatusFilter(value: string | undefined): SessionStatus[] {
  if (!value) return [];
  return [
    ...new Set(
      value
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
        .map(parseSessionStatus),
    ),
  ];
}
