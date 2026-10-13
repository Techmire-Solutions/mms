import type { AppTranslationKey } from "@mms/shared";
import type { CustomCard } from "@/lib/reports/reportMetadata";

const CARD_CONFIG_OVERRIDES: Record<string, Partial<CustomCard>> = {
  "kpi-avg-attendance": {
    collection: "attendance_records",
    operation: "percentage",
    filterValue: "present",
    icon: "UserCheck",
  },
  "kpi-fee-collected": {
    collection: "finance_invoices",
    operation: "sum",
    targetField: "finalAmt",
    filterValue: "paid",
    icon: "DollarSign",
    color: "blue",
  },
  "kpi-outstanding": {
    collection: "finance_invoices",
    operation: "sum",
    targetField: "finalAmt",
    filterValue: "unpaid",
    icon: "AlertCircle",
    color: "red",
  },
  "kpi-hasanat-awarded": {
    collection: "hasanat_distributions",
    operation: "sum",
    targetField: "points",
    filterField: "",
    icon: "Star",
    color: "amber",
  },
  "kpi-pass-rate": { operation: "percentage", icon: "GraduationCap", color: "violet" },
  "kpi-capacity-used": {
    collection: "sessions",
    operation: "percentage",
    icon: "BarChart2",
    color: "blue",
  },
  "kpi-growth-rate": { collection: "contacts", filterField: "", icon: "TrendingUp" },
  "kpi-whatsapp-verified": {
    collection: "contacts",
    operation: "percentage",
    filterField: "whatsappStatus",
    filterValue: "REGISTERED",
    icon: "MessageCircle",
    color: "amber",
  },
  "kpi-active-contacts": {
    collection: "contacts",
    operation: "percentage",
    filterField: "isActive",
    filterValue: "true",
    icon: "UserCheck",
    color: "green",
  },
  "kpi-total-contacts": { collection: "contacts", filterField: "", icon: "Users", color: "blue" },
  "kpi-total-questions": {
    collection: "questions",
    filterField: "",
    icon: "BarChart2",
    color: "blue",
  },
  "kpi-generated-tests": {
    collection: "tests",
    filterField: "",
    icon: "CalendarCheck",
    color: "blue",
  },
  "kpi-test-submissions": {
    collection: "assessment_results",
    filterField: "",
    icon: "UserCheck",
    color: "violet",
  },
  "kpi-avg-test-score": {
    collection: "assessment_results",
    operation: "percentage",
    filterField: "",
    icon: "Target",
    color: "green",
  },
  "kpi-total-faculty": { collection: "faculty", icon: "GraduationCap", color: "primary" },
  "kpi-on-leave": {
    collection: "faculty",
    filterValue: "on_leave",
    icon: "Activity",
    color: "amber",
  },
  "kpi-obligations-total": { icon: "Receipt", color: "primary" },
  "kpi-obligations-amount": { icon: "TrendingUp", color: "emerald" },
  "kpi-accounting-entries": { icon: "Receipt", color: "primary" },
  "kpi-accounting-surplus": { icon: "DollarSign", color: "emerald" },
  "kpi-users-total": { icon: "Users", color: "primary" },
  "kpi-users-sessions": { icon: "ShieldCheck", color: "blue" },
  "kpi-messaging-total": { icon: "MessageSquare", color: "primary" },
  "kpi-messaging-whatsapp": { icon: "MessageCircle", color: "emerald" },
};

const CATEGORY_DEFAULT_COLLECTIONS: Record<string, CustomCard["collection"]> = {
  contacts: "contacts",
  attendance: "attendance_records",
  financial: "finance_invoices",
  finance: "finance_invoices",
  accounting: "finance_invoices",
  hasanat: "hasanat_distributions",
  sessions: "sessions",
  enrollments: "enrollments",
  questionBank: "questions",
  faculty: "faculty",
};

const CATEGORY_LABEL_KEYS: Record<string, AppTranslationKey> = {
  contacts: "nav.contacts",
  students: "nav.students",
  attendance: "nav.attendance",
  financial: "nav.finance",
  finance: "nav.finance",
  hasanat: "nav.hasanatCards",
  sessions: "nav.sessions",
  examinations: "nav.examinations",
  questionBank: "nav.questionBank",
  enrollments: "nav.enrollments",
  faculty: "nav.faculty",
  accounting: "nav.accounting",
  obligations: "nav.obligations",
  messaging: "nav.messaging",
  users: "nav.users",
};

export function getDefaultCardConfig(
  category: string,
  cardId: string,
  title: string,
  titleKey?: AppTranslationKey,
): CustomCard {
  const baseConfig: CustomCard = {
    id: cardId,
    title,
    titleKey,
    collection: "students",
    operation: "count",
    filterField: "status",
    filterOperator: "equals",
    filterValue: "active",
    icon: "GraduationCap",
    color: "emerald",
    subTextType: "dynamic",
    fixedSubText: "",
  };

  if (cardId === "kpi-total-students" && category === "contacts") {
    return {
      ...baseConfig,
      collection: "contacts",
      filterField: "",
      icon: "Users",
      color: "blue",
    };
  }

  const overrides = CARD_CONFIG_OVERRIDES[cardId];
  return overrides ? { ...baseConfig, ...overrides } : baseConfig;
}

export function getDefaultKPICollection(category: string): CustomCard["collection"] {
  return CATEGORY_DEFAULT_COLLECTIONS[category] ?? "students";
}

export function getCategoryLabelKey(category: string): AppTranslationKey | undefined {
  return CATEGORY_LABEL_KEYS[category];
}
