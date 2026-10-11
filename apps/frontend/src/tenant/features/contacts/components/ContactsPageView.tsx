import React, { Suspense, lazy } from "react";
import { Users } from "lucide-react";
import { ModulePageShell } from "@/components/ui/ModulePageShell";
import { ResponsiveAccordionTabs } from "@/components/ui/ResponsiveAccordionTabs";
import { ContactsCommandMetrics } from "@/tenant/features/contacts/components/ContactsCommandMetrics";
import ContactsDataBanner from "@/tenant/features/contacts/components/ContactsDataBanner";
import ContactsSyncConflictPanel from "@/tenant/features/contacts/components/ContactsSyncConflictPanel";
import { ContactsPageOverlays } from "@/tenant/features/contacts/components/ContactsPageOverlays";
import { AnimatePresence } from "framer-motion";
import RouteStatusFallback from "@/components/routing/RouteStatusFallback";
import { ContactsWorkTier } from "@/tenant/features/contacts/components/ContactsWorkTier";
import { ContactsPageHeaderActions } from "@/tenant/features/contacts/components/ContactsPageHeaderActions";
import type { useContactsPageController } from "@/tenant/features/contacts/hooks/useContactsPageController";

const ContactsSetupTier = lazy(
  () => import("@/tenant/features/contacts/components/ContactsSetupTier"),
);
const ContactsReportsTier = lazy(() =>
  import("@/tenant/features/contacts/components/ContactsReportsTier").then((m) => ({
    default: m.ContactsReportsTier,
  })),
);

export type ContactsPageViewProps = ReturnType<typeof useContactsPageController>;

export function ContactsPageView({
  t,
  visibleTopTabs,
  effectiveTab,
  setActiveTab,
  canExport,
  canRead,
  canWrite,
  viewingDeleted,
  openingDuplicates,
  isExporting,
  handleOpenDuplicates,
  handleExportCSV,
  handleOpenImport,
  handleNew,
  shownCount,
  pendingCount,
  conflictCount,
  flushing,
  flush,
  openConflictReview,
  conflictPanelOpen,
  setConflictPanelOpen,
  tabPanelProps,
  overlayProps,
}: ContactsPageViewProps): React.JSX.Element {
  return (
    <ModulePageShell
      seoTitle={t("page.contacts.seoTitle")}
      seoDescription={t("page.contacts.subtitle")}
      headerIcon={Users}
      headerTitle={t("nav.contacts")}
      headerSubtitle={t("page.contacts.subtitle")}
      headerActions={
        <ContactsPageHeaderActions
          canExport={canExport}
          canRead={canRead}
          canWrite={canWrite}
          viewingDeleted={viewingDeleted}
          openingDuplicates={openingDuplicates}
          isExporting={isExporting}
          onOpenDuplicates={() => void handleOpenDuplicates()}
          onExport={handleExportCSV}
          onImport={handleOpenImport}
          onAddContact={handleNew}
        />
      }
      metricsStrip={
        <ContactsCommandMetrics
          shown={shownCount}
          pendingCount={pendingCount}
          conflictCount={conflictCount}
          flushing={flushing}
          onFlushPending={() => void flush()}
          onReviewConflicts={openConflictReview}
        />
      }
    >
      <ContactsDataBanner onReviewConflicts={openConflictReview} />

      <ContactsSyncConflictPanel
        open={conflictPanelOpen}
        onClose={() => setConflictPanelOpen(false)}
      />

      <ResponsiveAccordionTabs
        tabs={visibleTopTabs}
        activeTab={effectiveTab}
        onTabChange={setActiveTab}
        panelIdPrefix="contacts-tab"
      >
        <AnimatePresence mode="wait">
          {effectiveTab === "work" ? (
            <div className="space-y-5">
              <ContactsWorkTier {...tabPanelProps.workTierProps} />
            </div>
          ) : effectiveTab === "reports" ? (
            <Suspense fallback={<RouteStatusFallback />}>
              <ContactsReportsTier />
            </Suspense>
          ) : effectiveTab === "setup" ? (
            <Suspense fallback={<RouteStatusFallback />}>
              <ContactsSetupTier {...tabPanelProps.setupTierProps} />
            </Suspense>
          ) : null}
        </AnimatePresence>
      </ResponsiveAccordionTabs>

      <ContactsPageOverlays {...overlayProps} />
    </ModulePageShell>
  );
}
