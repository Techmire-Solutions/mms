/**
 * @file SessionDetail.tsx
 * @description Detail drawer for Session records (Classes, Timetable, Discounts, Budget, Events, Tabarruk).
 */
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GraduationCap, Wallet, UserCheck, Link2, History, Award, ArrowRight } from "lucide-react";
import { DetailDrawerShell } from "@/components/app/DetailDrawerShell";
import {
  DetailDrawerRestoreOrEditAction,
  DrawerSyncStatusFooter,
} from "@/components/app/DetailDrawerArchiveChrome";
import { SessionArchivedBanner } from "@/tenant/features/sessions/components/SessionArchivedBanner";
import { StatusBadge } from "@/components/app/StatusBadge";
import {
  formatMoney,
  SESSIONS_MODULE_MANIFEST,
  formatDate,
  isSessionReadOnly,
  sessionTypeI18nKey,
  type Session,
  type AppTranslationKey,
} from "@mms/shared";
import { useModulePermissions } from "@/tenant/hooks/usePermissions";
import { SubTabBar, type SubTab } from "@/components/app/SubTabBar";
import { useTranslation } from "@/hooks/useTranslation";
import { useAcademicTerms } from "@/hooks/useAcademicTerms";
import { sessionLifecycleDisplay } from "@/tenant/features/sessions/hooks/sessionLifecycleDisplay";

import { ClassesTab } from "@/tenant/features/sessions/components/tabs/ClassesTab";
import { FacultyManagementTab } from "@/tenant/features/sessions/components/tabs/FacultyManagementTab";
import { BudgetTab } from "@/tenant/features/sessions/components/tabs/BudgetTab";
import { RegistrationLinksTab } from "@/tenant/features/sessions/components/tabs/RegistrationLinksTab";
import { SessionActivityTab } from "@/tenant/features/sessions/components/tabs/SessionActivityTab";
import { SessionCompletionTab } from "@/tenant/features/sessions/components/tabs/SessionCompletionTab";
import { SessionLifecycleBar } from "@/tenant/features/sessions/components/SessionLifecycleBar";

const TAB_KEYS = [
  "classes",
  "faculty",
  "budget",
  "registration",
  "completion",
  "activity",
] as const;

const TAB_ICONS = {
  classes: GraduationCap,
  faculty: UserCheck,
  budget: Wallet,
  registration: Link2,
  completion: Award,
  activity: History,
} as const;

const TAB_COMPONENTS: Record<string, React.ElementType> = {
  classes: ClassesTab,
  faculty: FacultyManagementTab,
  budget: BudgetTab,
  registration: RegistrationLinksTab,
  completion: SessionCompletionTab,
  activity: SessionActivityTab,
};

export interface SessionDetailProps {
  session: Session;
  onClose: () => void;
  onUpdate: (session: Session) => void | Promise<void>;
  onEdit: (session: Session) => void;
  canDelete?: boolean;
  onRestore?: (sessionId: string) => void | Promise<void>;
}

export const SessionDetail = function SessionDetail({
  session,
  onClose,
  onUpdate,
  onEdit,
  canDelete = false,
  onRestore,
}: SessionDetailProps): React.JSX.Element {
  const { t, isRtl } = useTranslation();
  const terms = useAcademicTerms();
  const { canWrite, canOverrideLock } = useModulePermissions(SESSIONS_MODULE_MANIFEST);
  const [tab, setTab] = useState<string>("classes");
  const TabContent = TAB_COMPONENTS[tab];
  const isArchived = Boolean(session.deletedAt);
  // completed/cancelled are terminal: only an override-capable user may still edit them.
  const readOnlyStatus = isSessionReadOnly(session.status);
  const canMutate = canWrite && !isArchived && (!readOnlyStatus || canOverrideLock);

  const typeKey = sessionTypeI18nKey(session.type);
  const sessionTypeLabel = typeKey ? t(typeKey) : session.type;

  const { statusConfig } = sessionLifecycleDisplay(t);

  const tabs: readonly SubTab[] = (() =>
    TAB_KEYS.map((key) => ({
      key,
      label:
        key === "classes"
          ? terms.class.plural
          : t(`sessions.detail.tab.${key}` as AppTranslationKey),
      icon: TAB_ICONS[key],
    })))();

  const formatSessionDate = (date?: string | null) => formatDate(date, true);

  const headerActions = (
    <DetailDrawerRestoreOrEditAction
      isArchived={isArchived}
      canRestore={canDelete}
      canEdit={canMutate}
      restoreLabel={t("sessions.restore")}
      editLabel={t("sessions.detail.editTitle")}
      onRestore={onRestore ? () => onRestore(String(session.id)) : undefined}
      onEdit={() => onEdit(session)}
    />
  );

  return (
    <DetailDrawerShell
      onClose={onClose}
      title={session.name}
      subtitle={
        isArchived ? (
          t("sessions.detail.archivedSubtitle")
        ) : (
          <div className="mt-1 space-y-1">
            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              <span className="inline-flex items-center gap-1">
                {formatSessionDate(session.startDate)}
                <ArrowRight className="size-3 rtl:rotate-180" aria-hidden="true" />
                {formatSessionDate(session.endDate)}
              </span>
              <span className="font-semibold text-foreground">
                {t("sessions.form.perMonth", {
                  amount: formatMoney(session.baseFee, session.currency),
                })}
              </span>
            </div>
            {session.description ? (
              <p className="line-clamp-2 text-pretty text-xs text-muted-foreground">
                {session.description}
              </p>
            ) : null}
          </div>
        )
      }
      icon={GraduationCap}
      ariaLabel={t("sessions.detail.ariaLabel")}
      className="max-w-2xl"
      headerActions={headerActions}
      headerExtra={
        <>
          <SessionArchivedBanner session={session} />
          {!isArchived ? (
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge status={session.status} config={statusConfig} />
              {sessionTypeLabel ? (
                <span className="text-xs text-muted-foreground">{sessionTypeLabel}</span>
              ) : null}
            </div>
          ) : null}
          {canWrite && !isArchived ? <SessionLifecycleBar session={session} /> : null}
        </>
      }
      footer={
        <DrawerSyncStatusFooter
          isArchived={isArchived}
          archivedLabel={t("sessions.detail.archivedSubtitle")}
          syncedLabel={t("sessions.detail.synced")}
        />
      }
    >
      {!isArchived ? (
        <div className="flex flex-shrink-0 -mx-1 px-1 overflow-x-auto">
          <SubTabBar
            tabs={tabs}
            value={tab}
            onChange={setTab}
            variant="underline"
            panelIdPrefix="session-detail-subtab"
            resetScrollOnChange={false}
          />
        </div>
      ) : null}

      <div className="flex-1">
        {isArchived ? (
          <div className="space-y-3 text-sm text-muted-foreground">
            <p className="inline-flex items-center gap-1">
              {formatSessionDate(session.startDate)}
              <ArrowRight className="size-3 rtl:rotate-180" aria-hidden="true" />
              {formatSessionDate(session.endDate)}
            </p>
            {sessionTypeLabel ? <p>{sessionTypeLabel}</p> : null}
            <StatusBadge status={session.status} config={statusConfig} />
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.section
              key={tab}
              initial={{ opacity: 0, x: isRtl ? -8 : 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isRtl ? 8 : -8 }}
              transition={{ duration: 0.18 }}
              aria-label={tabs.find((tabDefinition) => tabDefinition.key === tab)?.label}
            >
              <TabContent
                session={session}
                onUpdate={onUpdate}
                canWrite={canMutate}
                canMutate={canMutate}
                onEdit={() => onEdit(session)}
              />
            </motion.section>
          </AnimatePresence>
        )}
      </div>
    </DetailDrawerShell>
  );
};
