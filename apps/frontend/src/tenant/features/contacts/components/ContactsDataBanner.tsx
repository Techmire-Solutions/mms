import type React from "react";
import { useState, useEffect } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { useContactsSyncOutbox } from "@/tenant/features/contacts/hooks/useContactsSyncOutbox";
import { ConfirmAlertDialog } from "@/components/app/ConfirmAlertDialog";
import {
  ContactsConflictBanner,
  ContactsOfflineBanner,
  ContactsPendingBanner,
} from "@/tenant/features/contacts/components/ContactsDataBannerRows";

export interface ContactsDataBannerProps {
  onReviewConflicts?: () => void;
}

/** Surfaces offline / sync outbox banners for the Contacts module. */
export function ContactsDataBanner({
  onReviewConflicts,
}: ContactsDataBannerProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const { pendingCount, conflictCount, flushing, flush, clearConflicts } = useContactsSyncOutbox();
  const [offline, setOffline] = useState(() =>
    typeof navigator !== "undefined" ? !navigator.onLine : false,
  );
  const [dismissAllOpen, setDismissAllOpen] = useState(false);

  useEffect(() => {
    const onOffline = () => setOffline(true);
    const onOnline = () => setOffline(false);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  const banners: JSX.Element[] = [];

  if (offline) {
    banners.push(<ContactsOfflineBanner key="offline" t={t} />);
  }

  if (pendingCount > 0 || flushing) {
    banners.push(
      <ContactsPendingBanner
        key="pending"
        pendingCount={pendingCount}
        flushing={flushing}
        onFlush={() => void flush()}
        t={t}
      />,
    );
  }

  if (conflictCount > 0) {
    banners.push(
      <ContactsConflictBanner
        key="conflicts"
        conflictCount={conflictCount}
        onReview={onReviewConflicts}
        onDismissAll={() => setDismissAllOpen(true)}
        t={t}
      />,
    );
  }

  if (banners.length === 0) return null;

  return (
    <>
      <div className="space-y-2">{banners}</div>
      <ConfirmAlertDialog
        open={dismissAllOpen}
        onOpenChange={setDismissAllOpen}
        title={t("contacts.sync.dismissConflictsConfirmTitle")}
        description={t("contacts.sync.dismissConflictsConfirmDesc", { count: conflictCount })}
        confirmLabel={t("contacts.sync.dismissConflicts")}
        onConfirm={() => {
          clearConflicts();
          setDismissAllOpen(false);
        }}
        destructive
      />
    </>
  );
}

export default ContactsDataBanner;
