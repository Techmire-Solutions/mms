/**
 * MMS Soft-Delete Reference: Outbox CDC Event Schemas & Tombstones
 * Emitted within the same transaction boundary as the soft-delete or restore.
 */
import { z } from 'zod';

export const softDeleteOutboxPayloadSchema = z.object({
  eventId: z.string().uuid(),
  eventType: z.enum(['entity.soft_deleted', 'entity.restored']),
  entityType: z.string(),
  entityId: z.string(),
  workspaceSubdomain: z.string(),
  version: z.number().int().positive(),
  timestamp: z.string().datetime(),
  actorId: z.string(),
  reason: z.string().max(500).optional(),
}).strict();

export type SoftDeleteOutboxPayload = z.infer<typeof softDeleteOutboxPayloadSchema>;
