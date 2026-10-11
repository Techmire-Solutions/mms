import {
  Activity,
  AlertCircle,
  BarChart2,
  DollarSign,
  GraduationCap,
  MessageCircle,
  Star,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";
import {
  formatNumber,
  type AttendanceCommandMetricsSnapshot,
  type FinanceCommandMetricsSnapshot,
  type AccountingCommandMetricsSnapshot,
  type ObligationsCommandMetricsSnapshot,
  type UsersCommandMetricsSnapshot,
  type HasanatCommandMetricsSnapshot,
  type SessionsCommandMetricsSnapshot,
  type ExaminationsCommandMetricsSnapshot,
  type QuestionBankCommandMetricsSnapshot,
  type QuestionBankQuestion,
  type QuestionBankResult,
  type QuestionBankTest,
} from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import type {
  CategorizedKPIItem,
  ContactKPIAnalytics,
  EntityKPIMetrics,
  FacultyKPIMetrics,
} from "./kpiSummaryTypes";
import { getKpiCategoryFlags } from "./kpiSummaryCategoryFlags";
import { buildQuestionBankKPICards } from "./kpiSummaryQuestionBankCards";
import { computeDerivedKpiMetrics } from "./kpiSummaryDerivedMetrics";
import { buildDomainKPICards } from "./kpiSummaryDomainCards";

interface BuildStandardKPICardsOptions {
  category: string;
  activeCurrencyCode: string;
  contactAnalytics?: ContactKPIAnalytics;
  studentMetrics?: EntityKPIMetrics;
  auxiliaryStudentMetrics?: EntityKPIMetrics;
  facultyMetrics?: FacultyKPIMetrics;
  auxiliaryFacultyMetrics?: FacultyKPIMetrics;
  attendanceMetrics?: AttendanceCommandMetricsSnapshot;
  financeMetrics?: FinanceCommandMetricsSnapshot;
  accountingMetrics?: AccountingCommandMetricsSnapshot;
  obligationsMetrics?: ObligationsCommandMetricsSnapshot;
  usersMetrics?: UsersCommandMetricsSnapshot;
  messagingMetrics?: {
    total?: number;
    sentCount?: number;
    deliveredCount?: number;
    failedCount?: number;
    smsCount?: number;
    whatsappCount?: number;
    emailCount?: number;
  };
  hasanatMetrics?: HasanatCommandMetricsSnapshot;
  sessionsMetrics?: SessionsCommandMetricsSnapshot;
  examinationsMetrics?: ExaminationsCommandMetricsSnapshot;
  questionBankMetrics?: QuestionBankCommandMetricsSnapshot;
  questionBankQuestions: QuestionBankQuestion[];
  questionBankTests: QuestionBankTest[];
  questionBankResults: QuestionBankResult[];
  t: TranslationFunction;
}

export function buildStandardKPICards(options: BuildStandardKPICardsOptions): CategorizedKPIItem[] {
  const {
    category,
    activeCurrencyCode,
    contactAnalytics,
    studentMetrics,
    auxiliaryStudentMetrics,
    facultyMetrics,
    auxiliaryFacultyMetrics,
    t,
  } = options;

  const derived = computeDerivedKpiMetrics(options);
  const isStudentsCategory = category === "students";
  const { isFacultyCategory } = getKpiCategoryFlags(category);
  const facultyValues = isFacultyCategory ? facultyMetrics : auxiliaryFacultyMetrics;
  const contactsRecent = contactAnalytics?.newThisPeriod ?? 0;
  const { cards: questionBankCards } = buildQuestionBankKPICards({
    questionBankMetrics: options.questionBankMetrics,
    questionBankQuestions: options.questionBankQuestions,
    questionBankTests: options.questionBankTests,
    questionBankResults: options.questionBankResults,
    t,
  });

  const domainCards = buildDomainKPICards({
    activeCurrencyCode,
    obligationsMetrics: options.obligationsMetrics,
    accountingMetrics: options.accountingMetrics,
    usersMetrics: options.usersMetrics,
    messagingMetrics: options.messagingMetrics,
    t,
  });

  return [
    {
      id: "kpi-total-students",
      icon: Users,
      label: t("reports.kpi.totalStudents"),
      value: derived.totalStudentsValue,
      sub: derived.totalStudentsSub,
      color: "primary",
      trend: derived.totalStudentsTrend,
      velocity: derived.totalStudentsVelocity,
      categories: ["students", "enrollments"],
      isAvailable:
        category === "contacts"
          ? (contactAnalytics?.total ?? 0) > 0
          : ((isStudentsCategory ? studentMetrics?.total : auxiliaryStudentMetrics?.total) ?? 0) >
            0,
    },
    {
      id: "kpi-avg-attendance",
      icon: UserCheck,
      label: t("reports.kpi.avgAttendance"),
      value: `${derived.attendanceRate}%`,
      sub: t("reports.kpi.sub.last30Days"),
      color: "success",
      trend: derived.attendanceTrend,
      categories: ["attendance"],
      isAvailable: derived.hasAttendanceData,
    },
    {
      id: "kpi-fee-collected",
      icon: DollarSign,
      label: t("reports.kpi.feeCollected"),
      value: `${activeCurrencyCode} ${(derived.collected / 1000).toFixed(1)}k`,
      sub: t("reports.kpi.sub.allTimeTotal"),
      color: "info",
      trend: derived.feesTrend,
      categories: ["finance", "financial", "accounting"],
      isAvailable: derived.hasFinanceData && (options.financeMetrics?.paid ?? 0) > 0,
    },
    {
      id: "kpi-outstanding",
      icon: AlertCircle,
      label: t("reports.kpi.outstanding"),
      value: `${activeCurrencyCode} ${(derived.outstanding / 1000).toFixed(1)}k`,
      sub: t("reports.kpi.sub.invoiceCount", { count: derived.outstandingInvoiceCount }),
      color: "destructive",
      trend: derived.outstandingTrend,
      categories: ["finance", "financial", "accounting"],
      isAvailable: derived.outstandingInvoiceCount > 0,
    },
    {
      id: "kpi-hasanat-awarded",
      icon: Star,
      label: t("reports.kpi.hasanatAwarded"),
      value: formatNumber(derived.totalHasanat),
      sub: t("reports.kpi.sub.allStudents"),
      color: "warning",
      trend: derived.hasanatTrend,
      categories: ["hasanat"],
      isAvailable: derived.hasHasanatData,
    },
    {
      id: "kpi-pass-rate",
      icon: GraduationCap,
      label: t("reports.kpi.passRate"),
      value: `${derived.passRate}%`,
      sub: t("reports.kpi.sub.lastExamCycle"),
      color: "primary",
      trend: "flat",
      categories: ["examinations", "academic", "students"],
      isAvailable: derived.hasExamData,
    },
    {
      id: "kpi-capacity-used",
      icon: BarChart2,
      label: t("reports.kpi.capacityUsed"),
      value: `${derived.capacityUsed}%`,
      sub: t("reports.kpi.sub.acrossClasses", { count: derived.classesCount }),
      color: "primary",
      trend: derived.sessionsTrend,
      categories: ["sessions", "enrollments"],
      isAvailable: derived.hasSessionsData,
    },
    {
      id: "kpi-growth-rate",
      icon: TrendingUp,
      label: t("reports.kpi.growthRate"),
      value: derived.growthValue,
      sub: derived.growthSub,
      color: "success",
      trend: derived.growthTrend,
      categories: ["students", "sessions"],
      isAvailable:
        category === "contacts" || category === "students" || category === "sessions"
          ? Boolean(contactAnalytics?.hasSignupDates)
          : false,
    },
    {
      id: "kpi-whatsapp-verified",
      icon: MessageCircle,
      label: t("reports.contacts.kpi.whatsappVerified"),
      value: contactAnalytics ? `${contactAnalytics.whatsappRate}%` : "0%",
      sub: t("reports.contacts.kpi.whatsappSub"),
      color: "warning",
      trend: "flat",
      categories: ["contacts"],
      isAvailable: (contactAnalytics?.total ?? 0) > 0,
    },
    {
      id: "kpi-missing-contact-info",
      icon: AlertCircle,
      label: t("reports.contacts.kpi.missingContactInfo"),
      value: String(contactAnalytics?.missingInfoCount ?? 0),
      sub: t("reports.contacts.kpi.missingContactInfoSub"),
      color: "destructive",
      trend: "flat",
      categories: ["contacts"],
      isAvailable:
        (contactAnalytics?.missingInfoCount ?? 0) > 0 || (contactAnalytics?.total ?? 0) > 0,
    },
    {
      id: "kpi-total-contacts",
      icon: Users,
      label: t("reports.contacts.kpi.totalContacts"),
      value: String(contactAnalytics?.total ?? 0),
      sub: t("reports.contacts.kpi.newRecently", { count: contactsRecent }),
      color: "primary",
      trend: contactsRecent > 0 ? "up" : "flat",
      categories: ["contacts"],
      isAvailable: (contactAnalytics?.total ?? 0) > 0,
    },
    ...questionBankCards,
    {
      id: "kpi-total-faculty",
      icon: GraduationCap,
      label: t("reports.kpi.totalFaculty"),
      value: String(facultyValues?.total ?? 0),
      sub: t("reports.kpi.sub.activeCount", { count: facultyValues?.active ?? 0 }),
      color: "primary",
      trend: (facultyValues?.newThisPeriod ?? 0) > 0 ? "up" : "flat",
      categories: ["faculty"],
      isAvailable: (facultyValues?.total ?? 0) > 0,
    },
    {
      id: "kpi-on-leave",
      icon: Activity,
      label: t("reports.kpi.onLeave"),
      value: String(facultyValues?.onLeave ?? 0),
      sub: t("reports.kpi.sub.facultyOnLeave"),
      color: "warning",
      trend: "flat",
      categories: ["faculty"],
      isAvailable: (facultyValues?.onLeave ?? 0) > 0,
    },
    ...domainCards,
  ];
}
