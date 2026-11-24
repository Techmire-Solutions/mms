-- Migration: 0105_sessions_restore_attribution.sql
-- Adds restored_at / restored_by columns to sessions and enrollments
-- to complete the §2.1 soft-delete column quintuple for these tables.
-- Safe additive change — both columns are nullable, no default required.

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS restored_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS restored_by TEXT;

ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS restored_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS restored_by TEXT;
