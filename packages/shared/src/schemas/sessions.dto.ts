import { z } from 'zod';
import { deepSanitizeStrings } from './sanitize.js';
import { SessionSchema } from '../sessionTypes.js';
import { stripSessionClientSoftDeleteFields } from '../sessionUtils.js';
import { bulkIdsBodySchema, type BulkIdsBody } from './api.dto.js';

const sessionCreateBodyBaseSchema = SessionSchema.omit({
  deletedAt: true,
  deletedBy: true,
  deletionReason: true,
  restoredAt: true,
  restoredBy: true,
  deletedWithCascade: true,
}).extend({
  id: z.string().optional(),
}).strict();

export const sessionCreateBodySchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
  const stripped = stripSessionClientSoftDeleteFields(raw as Record<string, unknown>);
  return deepSanitizeStrings(stripped);
}, sessionCreateBodyBaseSchema);

const sessionUpdateBodyBaseSchema = sessionCreateBodyBaseSchema.partial().extend({
  /** Required (with Sessions setup rights) to make locked changes to a started session; audited. */
  lockOverrideReason: z.string().trim().min(3).max(500).optional(),
}).strict();

export const sessionUpdateBodySchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
  const stripped = stripSessionClientSoftDeleteFields(raw as Record<string, unknown>);
  return deepSanitizeStrings(stripped);
}, sessionUpdateBodyBaseSchema);

export const sessionsBulkIdsSchema = bulkIdsBodySchema;

export type SessionCreateBody = z.infer<typeof sessionCreateBodySchema>;
export type SessionUpdateBody = z.infer<typeof sessionUpdateBodySchema>;
export type SessionsBulkIdsBody = BulkIdsBody;
