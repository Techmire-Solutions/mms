import React, { Suspense } from "react";
import { CardSkeleton } from "@shared/ui";
import { ContactsWorkTier } from "@/platform/features/contacts/components/ContactsWorkTier";
import { ContactsReportsTier } from "@/platform/features/contacts/components/ContactsReportsTier";
import { ContactsSetupTier } from "@/platform/features/contacts/components/ContactsSetupTier";

export type PlatformContactsTab = "work" | "reports" | "setup";

/** Contacts module tier dispatcher (Work → Reports → Setup). */
export function ContactsTier({ activeTab }: { activeTab: PlatformContactsTab }): React.JSX.Element {
  return (
    <Suspense fallback={<CardSkeleton count={3} />}>
      {activeTab === "work" && <ContactsWorkTier />}
      {activeTab === "reports" && <ContactsReportsTier />}
      {activeTab === "setup" && <ContactsSetupTier />}
    </Suspense>
  );
}
