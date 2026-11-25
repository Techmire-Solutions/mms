SET LOCAL lock_timeout = '2s';
--> statement-breakpoint
DROP TRIGGER IF EXISTS "trg_platform_contacts_forbid_hard_delete" ON "platform_contacts";
--> statement-breakpoint
CREATE TRIGGER "trg_platform_contacts_forbid_hard_delete"
  BEFORE DELETE ON "platform_contacts"
  FOR EACH ROW EXECUTE FUNCTION forbid_hard_delete();
--> statement-breakpoint
DROP TRIGGER IF EXISTS "trg_platform_messages_forbid_hard_delete" ON "platform_messages";
--> statement-breakpoint
CREATE TRIGGER "trg_platform_messages_forbid_hard_delete"
  BEFORE DELETE ON "platform_messages"
  FOR EACH ROW EXECUTE FUNCTION forbid_hard_delete();
