-- Migration 0067: Add tag column to contacts table
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "tag" varchar(100);
