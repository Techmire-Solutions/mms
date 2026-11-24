import { describe, expect, it } from "vitest";
import {
  applyModuleColumnKinds,
  buildAccountingAccountWorkColumnRegistry,
  buildAccountingJournalWorkColumnRegistry,
  buildAttendanceWorkColumnRegistry,
  buildEnrollmentWorkColumnRegistry,
  buildExaminationExamWorkColumnRegistry,
  buildExaminationResultsWorkColumnRegistry,
  buildFacultyWorkColumnRegistry,
  buildFinanceInvoiceWorkColumnRegistry,
  buildFinancePaymentWorkColumnRegistry,
  buildHasanatDistributionWorkColumnRegistry,
  buildHasanatRedemptionWorkColumnRegistry,
  buildMessagingHistoryWorkColumnRegistry,
  buildMessagingRecipientsWorkColumnRegistry,
  buildMessagingTemplatesWorkColumnRegistry,
  buildObligationCollectionWorkColumnRegistry,
  buildQuestionBankWorkColumnRegistry,
  buildSessionWorkColumnRegistry,
  buildStudentWorkColumnRegistry,
  buildUsersActivityWorkColumnRegistry,
  buildUsersWorkColumnRegistry,
  MODULE_COLUMN_KIND_WIDTHS,
  type ModuleColumnRegistryEntry,
} from "../settings/moduleColumnPreferences.js";

/** Label bag that answers every key with the key itself. */
const keyLabels = new Proxy({}, { get: (_target, key) => String(key) }) as never;

const REGISTRIES: Record<string, () => ModuleColumnRegistryEntry[]> = {
  accountingAccounts: () => buildAccountingAccountWorkColumnRegistry(keyLabels),
  accountingJournal: () => buildAccountingJournalWorkColumnRegistry(keyLabels),
  attendance: () => buildAttendanceWorkColumnRegistry(keyLabels),
  enrollments: () => buildEnrollmentWorkColumnRegistry(keyLabels),
  examinations: () => buildExaminationExamWorkColumnRegistry(keyLabels),
  examinationResults: () => buildExaminationResultsWorkColumnRegistry(keyLabels),
  faculty: () => buildFacultyWorkColumnRegistry({} as never, keyLabels),
  financeInvoices: () => buildFinanceInvoiceWorkColumnRegistry(keyLabels),
  financePayments: () => buildFinancePaymentWorkColumnRegistry(keyLabels),
  hasanatDistributions: () => buildHasanatDistributionWorkColumnRegistry(keyLabels),
  hasanatRedemptions: () => buildHasanatRedemptionWorkColumnRegistry(keyLabels),
  messagingHistory: () => buildMessagingHistoryWorkColumnRegistry(keyLabels),
  messagingRecipients: () => buildMessagingRecipientsWorkColumnRegistry(keyLabels),
  messagingTemplates: () => buildMessagingTemplatesWorkColumnRegistry(keyLabels),
  obligations: () => buildObligationCollectionWorkColumnRegistry(keyLabels),
  questionBank: () => buildQuestionBankWorkColumnRegistry(keyLabels),
  sessions: () => buildSessionWorkColumnRegistry(keyLabels),
  students: () => buildStudentWorkColumnRegistry({} as never, keyLabels),
  users: () => buildUsersWorkColumnRegistry(keyLabels),
  usersActivity: () => buildUsersActivityWorkColumnRegistry(keyLabels),
};

describe("module Work column registries", () => {
  it.each(Object.entries(REGISTRIES))(
    "given the %s registry, should give every built-in column a kind and a width at or above its floor",
    (_name, build) => {
      // Arrange
      const registry = build();

      // Act
      const unsized = registry.filter(
        (column) =>
          !column.kind ||
          typeof column.width !== "number" ||
          column.width < MODULE_COLUMN_KIND_WIDTHS[column.kind].minWidth,
      );

      // Assert
      expect(registry.length).toBeGreaterThan(0);
      expect(unsized.map((column) => column.key)).toEqual([]);
    },
  );
});

describe("applyModuleColumnKinds", () => {
  it("given a stored width below the kind floor, should tag the kind and raise the width", () => {
    // Arrange
    const entries = [{ key: "amount", width: 80 }, { key: "custom:extra" }];

    // Act
    const result = applyModuleColumnKinds(entries, { amount: "money" });

    // Assert
    expect(result).toEqual([
      { key: "amount", kind: "money", width: MODULE_COLUMN_KIND_WIDTHS.money.minWidth },
      { key: "custom:extra" },
    ]);
  });

  it("given no width, should seed the kind default", () => {
    // Arrange
    const entries = [{ key: "code" }];

    // Act
    const [code] = applyModuleColumnKinds(entries, { code: "code" });

    // Assert
    expect(code).toEqual({
      key: "code",
      kind: "code",
      width: MODULE_COLUMN_KIND_WIDTHS.code.width,
    });
  });
});
