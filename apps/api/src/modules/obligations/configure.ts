import { configureObligationsPorts } from "@mms/mod-obligations/backend/ports";
import { listAccountsByWorkspace } from "@mms/mod-accounting/backend/repository";
import {
  findObligationJournalEntry,
  syncObligationJournal,
  tryPostObligationArchiveJournal,
  tryPostObligationJournal,
  tryPostObligationRestoreJournal,
} from "@mms/mod-accounting/backend/ledger-posting";

configureObligationsPorts({
  listAccountsByWorkspace: (tenant: string) => listAccountsByWorkspace(tenant) as never,
  syncObligationJournal: syncObligationJournal as never,
  tryPostObligationArchiveJournal: tryPostObligationArchiveJournal as never,
  tryPostObligationJournal: tryPostObligationJournal as never,
  tryPostObligationRestoreJournal: tryPostObligationRestoreJournal as never,
  findObligationJournalEntry: findObligationJournalEntry as never,
});
