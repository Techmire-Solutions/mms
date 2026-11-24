-- Migration 0060: Add is_verified to contact_emails
ALTER TABLE "contact_emails" ADD COLUMN IF NOT EXISTS "is_verified" boolean NOT NULL DEFAULT false;
