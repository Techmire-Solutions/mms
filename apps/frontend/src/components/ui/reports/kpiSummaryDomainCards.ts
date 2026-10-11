import {
  DollarSign,
  MessageCircle,
  MessageSquare,
  Receipt,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react";
import type {
  AccountingCommandMetricsSnapshot,
  ObligationsCommandMetricsSnapshot,
  UsersCommandMetricsSnapshot,
} from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import type { CategorizedKPIItem } from "./kpiSummaryTypes";

export interface BuildDomainKPICardsOptions {
  activeCurrencyCode: string;
  obligationsMetrics?: ObligationsCommandMetricsSnapshot;
  accountingMetrics?: AccountingCommandMetricsSnapshot;
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
  t: TranslationFunction;
}

export function buildDomainKPICards({
  activeCurrencyCode,
  obligationsMetrics,
  accountingMetrics,
  usersMetrics,
  messagingMetrics,
  t,
}: BuildDomainKPICardsOptions): CategorizedKPIItem[] {
  return [
    // Obligations
    {
      id: "kpi-obligations-total",
      icon: Receipt,
      label: t("obligations.summary.kpi.totalCollections"),
      value: String(obligationsMetrics?.total ?? 0),
      sub: `${obligationsMetrics?.obligationTypes ?? 0} types`,
      color: "primary",
      trend: "flat",
      categories: ["obligations"],
      isAvailable: (obligationsMetrics?.total ?? 0) > 0,
    },
    {
      id: "kpi-obligations-amount",
      icon: TrendingUp,
      label: t("obligations.summary.kpi.totalAmountReceived"),
      value: `${activeCurrencyCode} ${((obligationsMetrics?.totalAmount ?? 0) / 1000).toFixed(1)}k`,
      sub: `${activeCurrencyCode} Cash: ${((obligationsMetrics?.cash ?? 0) / 1000).toFixed(1)}k`,
      color: "success",
      trend: "flat",
      categories: ["obligations"],
      isAvailable: (obligationsMetrics?.totalAmount ?? 0) > 0,
    },
    // Accounting
    {
      id: "kpi-accounting-entries",
      icon: Receipt,
      label: t("accounting.reports.views.income"),
      value: String(accountingMetrics?.totalEntries ?? 0),
      sub: `${accountingMetrics?.posted ?? 0} posted`,
      color: "primary",
      trend: "flat",
      categories: ["accounting"],
      isAvailable: (accountingMetrics?.totalEntries ?? 0) > 0,
    },
    {
      id: "kpi-accounting-surplus",
      icon: DollarSign,
      label: t("accounting.reports.netSurplus"),
      value: `${activeCurrencyCode} ${((accountingMetrics?.surplus ?? 0) / 1000).toFixed(1)}k`,
      sub: `${activeCurrencyCode} Rev: ${((accountingMetrics?.revenue ?? 0) / 1000).toFixed(1)}k`,
      color: (accountingMetrics?.surplus ?? 0) >= 0 ? "success" : "destructive",
      trend: "flat",
      categories: ["accounting"],
      isAvailable: Boolean(accountingMetrics),
    },
    // Users
    {
      id: "kpi-users-total",
      icon: Users,
      label: t("nav.users"),
      value: String(usersMetrics?.total ?? 0),
      sub: `${usersMetrics?.active ?? 0} active`,
      color: "primary",
      trend: "flat",
      categories: ["users"],
      isAvailable: (usersMetrics?.total ?? 0) > 0,
    },
    {
      id: "kpi-users-sessions",
      icon: ShieldCheck,
      label: t("users.detailSessions"),
      value: String(usersMetrics?.activeSessions ?? 0),
      sub: `${usersMetrics?.twoFaEnabled ?? 0} 2FA`,
      color: "info",
      trend: "flat",
      categories: ["users"],
      isAvailable: (usersMetrics?.total ?? 0) > 0,
    },
    // Messaging
    {
      id: "kpi-messaging-total",
      icon: MessageSquare,
      label: t("nav.messaging"),
      value: String(messagingMetrics?.total ?? 0),
      sub: `${messagingMetrics?.deliveredCount ?? 0} delivered`,
      color: "primary",
      trend: "flat",
      categories: ["messaging"],
      isAvailable: (messagingMetrics?.total ?? 0) > 0,
    },
    {
      id: "kpi-messaging-whatsapp",
      icon: MessageCircle,
      label: t("messaging.channel.whatsapp"),
      value: String(messagingMetrics?.whatsappCount ?? 0),
      sub: `SMS: ${messagingMetrics?.smsCount ?? 0}`,
      color: "success",
      trend: "flat",
      categories: ["messaging"],
      isAvailable: (messagingMetrics?.total ?? 0) > 0,
    },
  ];
}
