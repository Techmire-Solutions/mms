import React, { lazy } from "react";
import { Users } from "lucide-react";
import { ModuleTierPage, type ModuleTierPageSpec } from "@/components/app/ModuleTierPage";
import { ContactsCommandMetrics } from "@/tenant/features/contacts/components/ContactsCommandMetrics";
import ContactsDataBanner from "@/tenant/features/contacts/components/ContactsDataBanner";
import ContactsSyncConflictPanel from "@/tenant/features/contacts/components/ContactsSyncConflictPanel";
import { ContactsPageOverlays } from "@/tenant/features/contacts/components/ContactsPageOverlays";
import { ContactsWorkTier } from "@/tenant/features/contacts/components/ContactsWorkTier";
import { ContactsPageHeaderActions } from "@/tenant/features/contacts/components/ContactsPageHeaderActions";
import type { useContactsPageController } from "@/tenant/features/contacts/hooks/useContactsPageController";

const ContactsSetupTier = lazy(
  () => import("@/tenant/features/contacts/components/ContactsSetupTier"),
);
const ContactsReportsTier = lazy(() =>
  import("@/tenant/components/moduleReports").then((m) => ({ default: m.ModuleReportsTier })),
);

const CONTACTS_PAGE_SPEC: ModuleTierPageSpec = {
  seoTitleKey: "page.contacts.seoTitle",
  subtitleKey: "page.contacts.subtitle",
  headerTitleKey: "nav.contacts",
  headerIcon: Users,
  panelIdPrefix: "contacts-tab",
};

export type ContactsPageViewProps = ReturnType<typeof useContactsPageController>;

export function ContactsPageView({
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
    <ModuleTierPage
      spec={CONTACTS_PAGE_SPEC}
      tabs={visibleTopTabs}
      activeTab={effectiveTab}
      onTabChange={setActiveTab}
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
      metrics={
        <ContactsCommandMetrics
          shown={shownCount}
          pendingCount={pendingCount}
          conflictCount={conflictCount}
          flushing={flushing}
          onFlushPending={() => void flush()}
          onReviewConflicts={openConflictReview}
        />
      }
      banner={
        <>
          <ContactsDataBanner onReviewConflicts={openConflictReview} />

          <ContactsSyncConflictPanel
            open={conflictPanelOpen}
            onClose={() => setConflictPanelOpen(false)}
          />
        </>
      }
      tiers={[
        { id: "work", content: <ContactsWorkTier {...tabPanelProps.workTierProps} /> },
        { id: "reports", content: <ContactsReportsTier category="contacts" />, lazy: true },
        {
          id: "setup",
          content: <ContactsSetupTier {...tabPanelProps.setupTierProps} />,
          lazy: true,
        },
      ]}
      overlays={<ContactsPageOverlays {...overlayProps} />}
    />
  );
}
