import { relations } from "drizzle-orm";
import { workspaces } from "../platform.js";
import {
  accountingAccounts,
  accountingFiscalYears,
  accountingEntries,
  accountingJournalLines,
  accountingEntryTags,
  accountingEntryAttachments,
} from "../accounting.js";
import {
  accountingPostingRules,
  accountingOpeningBalances,
  accountingBankStatements,
  accountingBankStatementLines,
  accountingBankReconciliations,
} from "../accountingLedgerOps.js";
import {
  accountingVoucherCounters,
  accountingVoucherNumbering,
} from "../accountingVoucherNumbering.js";

export const accountingAccountsRelations = relations(accountingAccounts, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [accountingAccounts.workspaceSubdomain],
    references: [workspaces.subdomain],
  }),
  lines: many(accountingJournalLines),
}));

export const accountingFiscalYearsRelations = relations(accountingFiscalYears, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [accountingFiscalYears.workspaceSubdomain],
    references: [workspaces.subdomain],
  }),
  entries: many(accountingEntries),
  openingBalances: many(accountingOpeningBalances),
}));

export const accountingEntriesRelations = relations(accountingEntries, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [accountingEntries.workspaceSubdomain],
    references: [workspaces.subdomain],
  }),
  fiscalYearRow: one(accountingFiscalYears, {
    fields: [accountingEntries.workspaceSubdomain, accountingEntries.fiscalYearId],
    references: [accountingFiscalYears.workspaceSubdomain, accountingFiscalYears.id],
  }),
  lines: many(accountingJournalLines),
  tags: many(accountingEntryTags),
  attachments: many(accountingEntryAttachments),
  bankMatches: many(accountingBankReconciliations),
}));

export const accountingJournalLinesRelations = relations(accountingJournalLines, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [accountingJournalLines.workspaceSubdomain],
    references: [workspaces.subdomain],
  }),
  entry: one(accountingEntries, {
    fields: [accountingJournalLines.workspaceSubdomain, accountingJournalLines.entryId],
    references: [accountingEntries.workspaceSubdomain, accountingEntries.id],
  }),
  account: one(accountingAccounts, {
    fields: [accountingJournalLines.workspaceSubdomain, accountingJournalLines.accountId],
    references: [accountingAccounts.workspaceSubdomain, accountingAccounts.id],
  }),
}));

export const accountingEntryTagsRelations = relations(accountingEntryTags, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [accountingEntryTags.workspaceSubdomain],
    references: [workspaces.subdomain],
  }),
  entry: one(accountingEntries, {
    fields: [accountingEntryTags.workspaceSubdomain, accountingEntryTags.entryId],
    references: [accountingEntries.workspaceSubdomain, accountingEntries.id],
  }),
}));

export const accountingEntryAttachmentsRelations = relations(
  accountingEntryAttachments,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [accountingEntryAttachments.workspaceSubdomain],
      references: [workspaces.subdomain],
    }),
    entry: one(accountingEntries, {
      fields: [accountingEntryAttachments.workspaceSubdomain, accountingEntryAttachments.entryId],
      references: [accountingEntries.workspaceSubdomain, accountingEntries.id],
    }),
  }),
);

export const accountingPostingRulesRelations = relations(accountingPostingRules, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [accountingPostingRules.workspaceSubdomain],
    references: [workspaces.subdomain],
  }),
}));

export const accountingOpeningBalancesRelations = relations(
  accountingOpeningBalances,
  ({ one }) => ({
    fiscalYear: one(accountingFiscalYears, {
      fields: [
        accountingOpeningBalances.workspaceSubdomain,
        accountingOpeningBalances.fiscalYearId,
      ],
      references: [accountingFiscalYears.workspaceSubdomain, accountingFiscalYears.id],
    }),
    account: one(accountingAccounts, {
      fields: [accountingOpeningBalances.workspaceSubdomain, accountingOpeningBalances.accountId],
      references: [accountingAccounts.workspaceSubdomain, accountingAccounts.id],
    }),
  }),
);

export const accountingBankStatementsRelations = relations(
  accountingBankStatements,
  ({ one, many }) => ({
    workspace: one(workspaces, {
      fields: [accountingBankStatements.workspaceSubdomain],
      references: [workspaces.subdomain],
    }),
    account: one(accountingAccounts, {
      fields: [accountingBankStatements.workspaceSubdomain, accountingBankStatements.accountId],
      references: [accountingAccounts.workspaceSubdomain, accountingAccounts.id],
    }),
    lines: many(accountingBankStatementLines),
  }),
);

export const accountingBankStatementLinesRelations = relations(
  accountingBankStatementLines,
  ({ one }) => ({
    statement: one(accountingBankStatements, {
      fields: [
        accountingBankStatementLines.workspaceSubdomain,
        accountingBankStatementLines.statementId,
      ],
      references: [accountingBankStatements.workspaceSubdomain, accountingBankStatements.id],
    }),
  }),
);

export const accountingBankReconciliationsRelations = relations(
  accountingBankReconciliations,
  ({ one }) => ({
    entry: one(accountingEntries, {
      fields: [
        accountingBankReconciliations.workspaceSubdomain,
        accountingBankReconciliations.journalEntryId,
      ],
      references: [accountingEntries.workspaceSubdomain, accountingEntries.id],
    }),
  }),
);

export const accountingVoucherNumberingRelations = relations(
  accountingVoucherNumbering,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [accountingVoucherNumbering.workspaceSubdomain],
      references: [workspaces.subdomain],
    }),
  }),
);

export const accountingVoucherCountersRelations = relations(
  accountingVoucherCounters,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [accountingVoucherCounters.workspaceSubdomain],
      references: [workspaces.subdomain],
    }),
  }),
);
