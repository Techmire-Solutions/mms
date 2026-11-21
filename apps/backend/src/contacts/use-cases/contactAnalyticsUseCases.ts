import {
  DEFAULT_ENABLED_TABS,
  DEFAULT_FORM_TABS,
  DEFAULT_REQUIRED_TABS,
  type ContactsCommandMetricsSnapshot,
  type ContactsMonthlyYearCounts,
  type ContactsReportAnalyticsSnapshot,
  type ContactsWidgetAggregateResult,
  type ContactsWidgetQuery,
  type FieldConfig,
} from "@mms/shared";
import { getRequestTenant } from "../../lib/tenantContext.js";
import { logger } from "../../lib/logger.js";
import { loadContactFieldConfig } from "./contactConfigService.js";
import { loadDuplicatePairs } from "./contactDuplicateScanUseCases.js";
import type { ContactsRepository } from "../repository/contactsRepository.js";
import { contactsRepository } from "../repository/contactsRepositoryAdapter.js";

function metricsFieldConfig(fieldConfig: FieldConfig | null): FieldConfig {
  if (fieldConfig?.fields && fieldConfig.formTabs) return fieldConfig;
  return {
    version: 1,
    enabledTabs: [...DEFAULT_ENABLED_TABS],
    requiredTabs: [...DEFAULT_REQUIRED_TABS],
    fields: {},
    formTabs: DEFAULT_FORM_TABS,
  };
}

/** A failed duplicate scan degrades the card to 0 instead of failing every metric. */
async function countDuplicatePairs(repo: ContactsRepository): Promise<number> {
  try {
    return (await loadDuplicatePairs(repo)).length;
  } catch (error) {
    logger.warn({ err: error }, "Contact duplicate count unavailable; reporting 0");
    return 0;
  }
}

export async function loadContactsCommandMetrics(
  repo: ContactsRepository = contactsRepository,
): Promise<ContactsCommandMetricsSnapshot> {
  const tenant = getRequestTenant();
  if (!tenant) {
    return {
      total: 0,
      newThisPeriod: 0,
      whatsappCount: 0,
      incompleteCount: 0,
      duplicatePairCount: 0,
    };
  }
  const fieldConfig = await loadContactFieldConfig();
  // Same pair set as the Potential Duplicates list (name matches included): the cached
  // scan when warm, otherwise one SQL-blocked scan that is then cached for the list.
  const duplicatePairCount = await countDuplicatePairs(repo);
  return repo.aggregateCommandMetrics(tenant, metricsFieldConfig(fieldConfig), {
    duplicatePairCount,
  });
}

export async function loadContactsReportAnalytics(
  options?: {
    compareYears?: number[];
    language?: string;
  },
  repo: ContactsRepository = contactsRepository,
): Promise<{
  analytics: ContactsReportAnalyticsSnapshot;
  monthlyByYear?: ContactsMonthlyYearCounts[];
}> {
  const tenant = getRequestTenant();
  if (!tenant) {
    return {
      analytics: {
        total: 0,
        activeCount: 0,
        whatsappCount: 0,
        whatsappRate: 0,
        missingInfoCount: 0,
        newLast30Days: 0,
        newPrior30Days: 0,
        newThisPeriod: 0,
        hasSignupDates: false,
        growthRecentSignups30d: 0,
        growthPriorSignups30d: 0,
      },
    };
  }

  const analytics = await repo.aggregateReportAnalytics(tenant);
  const years = options?.compareYears?.filter(Boolean) ?? [];
  if (years.length === 0) {
    return { analytics };
  }

  const language = options?.language || "en";
  const monthlyByYear = await repo.aggregateMonthlyCreatedCounts(tenant, years, 6, language);
  return { analytics, monthlyByYear };
}

export async function loadContactsWidgetAggregates(
  queries: ContactsWidgetQuery[],
  repo: ContactsRepository = contactsRepository,
): Promise<Record<string, ContactsWidgetAggregateResult>> {
  const tenant = getRequestTenant();
  if (!tenant) return {};
  return repo.aggregateWidgetQueries(tenant, queries);
}
