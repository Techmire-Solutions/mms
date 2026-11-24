-- Drop scalar duplicate columns from contacts table
ALTER TABLE "contacts" DROP COLUMN IF EXISTS "phone";
ALTER TABLE "contacts" DROP COLUMN IF EXISTS "email";
ALTER TABLE "contacts" DROP COLUMN IF EXISTS "line1";
ALTER TABLE "contacts" DROP COLUMN IF EXISTS "address";
ALTER TABLE "contacts" DROP COLUMN IF EXISTS "city";
ALTER TABLE "contacts" DROP COLUMN IF EXISTS "state";
ALTER TABLE "contacts" DROP COLUMN IF EXISTS "country";

-- Note: In PostgreSQL, dropping a column that is part of an index or a unique constraint 
-- will automatically drop that index/constraint if CASCADE is used, or fail. 
-- However, we should explicitly drop the indexes just to be safe.
DROP INDEX IF EXISTS "contacts_workspace_phone_idx";
DROP INDEX IF EXISTS "contacts_workspace_email_idx";
DROP INDEX IF EXISTS "contacts_workspace_city_idx";
DROP INDEX IF EXISTS "contacts_workspace_phone_active_uidx";
DROP INDEX IF EXISTS "contacts_workspace_email_active_uidx";
