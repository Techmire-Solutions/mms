-- Migration 0071: Promote branding fields from objects store → workspaces table columns.
-- All columns nullable; defaults applied at data-migration time (migration 078).
-- socialLinks stored as jsonb (replaces JSONB blob in objects store).

ALTER TABLE "workspaces"
  ADD COLUMN IF NOT EXISTS "primary_color"       varchar(20),
  ADD COLUMN IF NOT EXISTS "secondary_color"     varchar(20),
  ADD COLUMN IF NOT EXISTS "corner_style"        varchar(20),
  ADD COLUMN IF NOT EXISTS "logo_url"            text,
  ADD COLUMN IF NOT EXISTS "favicon_url"         text,
  ADD COLUMN IF NOT EXISTS "footer_text"         varchar(120),
  ADD COLUMN IF NOT EXISTS "email"               varchar(255),
  ADD COLUMN IF NOT EXISTS "phone"               varchar(40),
  ADD COLUMN IF NOT EXISTS "website"             text,
  ADD COLUMN IF NOT EXISTS "legal_name"          varchar(255),
  ADD COLUMN IF NOT EXISTS "registration_number" varchar(100),
  ADD COLUMN IF NOT EXISTS "address_line1"       varchar(255),
  ADD COLUMN IF NOT EXISTS "address_line2"       varchar(255),
  ADD COLUMN IF NOT EXISTS "city"                varchar(100),
  ADD COLUMN IF NOT EXISTS "region"              varchar(100),
  ADD COLUMN IF NOT EXISTS "postal_code"         varchar(20),
  ADD COLUMN IF NOT EXISTS "social_links"        jsonb;
