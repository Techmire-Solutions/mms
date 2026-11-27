import React, { lazy } from "react";
import { Users } from "lucide-react";
import { ModuleTierPage, type ModuleTierPageSpec } from "./ModuleTierPage.js";
import { ContactsCommandMetrics } from "./ContactsCommandMetrics.js";
import ContactsDataBanner from "./ContactsDataBanner.js";
import ContactsSyncConflictPanel from "./ContactsSyncConflictPanel.js";
import { ContactsPageOverlays } from "./ContactsPageOverlays.js";
import { ContactsWorkTier } from "./ContactsWorkTier.js";
import { ContactsPageHeaderActions } from "./ContactsPageHeaderActions.js";
import type { useContactsPageController } from "../hooks/useContactsPageController";

const ContactsSetupTier = lazy(() => import("./ContactsSetupTier.js"));
const ContactsReportsTier = lazy(() =>
  import("./reports.js").then((m) => ({ default: m.ModuleReportsTier })),
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
  handleOpenCsvImport,
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
          onImportCsv={handleOpenCsvImport}
          onAddContact={handleNew}
          onExitTrash={() => tabPanelProps.workTierProps.onShowDeletedChange(false)}
        />
      }
      metrics={
        <ContactsCommandMetrics
          shown={effectiveTab === "work" ? shownCount : undefined}
          pendingCount={pendingCount}
          conflictCount={conflictCount}
          flushing={flushing}
          onFlushPending={() => void flush()}
          onReviewConflicts={openConflictReview}
          onReviewDuplicates={() => void handleOpenDuplicates()}
        />
      }
      banner={
        <>
          <ContactsDataBanner onReviewConflicts={openConflictReview} />

          <ContactsSyncConflictPanel
            open={conflictPanelOpen}
            canWrite={canWrite}
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
