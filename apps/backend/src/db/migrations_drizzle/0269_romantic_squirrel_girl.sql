-- 0269_romantic_squirrel_girl.sql
-- Adds a "month + year" (YYYYMM) year format and a monthly rollover to journal
-- voucher numbering. `year_format` widens from varchar(4) to varchar(6) so
-- `YYYYMM` fits; the two CHECKs are re-added with the widened value set.
SET LOCAL lock_timeout = '2s';--> statement-breakpoint
ALTER TABLE "accounting_voucher_numbering" DROP CONSTRAINT "accounting_voucher_numbering_year_format_check";--> statement-breakpoint
ALTER TABLE "accounting_voucher_numbering" DROP CONSTRAINT "accounting_voucher_numbering_rollover_check";--> statement-breakpoint
ALTER TABLE "accounting_voucher_numbering" ALTER COLUMN "year_format" SET DATA TYPE varchar(6);--> statement-breakpoint
ALTER TABLE "accounting_voucher_numbering" ALTER COLUMN "year_format" SET DEFAULT 'NONE';--> statement-breakpoint
ALTER TABLE "accounting_voucher_numbering" ADD CONSTRAINT "accounting_voucher_numbering_year_format_check" CHECK ("accounting_voucher_numbering"."year_format" IN ('YYYY', 'YY', 'YYYYMM', 'NONE'));--> statement-breakpoint
ALTER TABLE "accounting_voucher_numbering" ADD CONSTRAINT "accounting_voucher_numbering_rollover_check" CHECK ("accounting_voucher_numbering"."rollover_policy" IN ('monthly', 'annual_calendar', 'annual_fiscal', 'never'));
