-- Migration: 0187_message_logs_restore_attribution.sql
-- Adds restored_at / restored_by columns to message_logs so soft-archived logs
-- can be restored with actor attribution (messaging.logs.restore).
-- Safe additive change — both columns are nullable, no default, no table rewrite.

ALTER TABLE "message_logs"
  ADD COLUMN IF NOT EXISTS "restored_at" TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS "restored_by" TEXT;
