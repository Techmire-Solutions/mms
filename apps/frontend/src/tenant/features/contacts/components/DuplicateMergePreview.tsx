import type React from "react";
import { useState } from "react";
import { AlertTriangle, GitMerge, Loader2 } from "lucide-react";
import { mergeContacts, getDisplayName, type Contact } from "@mms/shared";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/app/Modal";
import { Alert } from "@/components/app/Alert";
import { useContactConfig } from "@/lib/contexts/ContactConfigContext";
import { useTranslation } from "@/hooks/useTranslation";
import {
  getDuplicateThemeColors,
  type DuplicatePair,
} from "@/tenant/features/contacts/lib/duplicateDetectionTypes";
import { DuplicateMergeFieldsList } from "@/tenant/features/contacts/components/DuplicateMergeFieldsList";

export interface MergePreviewProps {
  pair: DuplicatePair;
  keepIndex: number;
  onClose: () => void;
  onConfirm: (mergedCustom?: Contact) => void;
  confirming?: boolean;
}

function resolveCustomMerged(
  defaultMerged: Contact,
  fieldOverrides: Record<string, number>,
  keep: Contact,
  other: Contact,
): Contact {
  const next: Contact = { ...defaultMerged };
  for (const [field, selectedIndex] of Object.entries(fieldOverrides)) {
    const source = selectedIndex === 0 ? keep : other;
    if (field === "name") {
      next.name = source.name || source.firstName || next.name;
      next.firstName = source.firstName ?? next.firstName;
      next.lastName = source.lastName ?? next.lastName;
    } else if (field === "dob") {
      next.dob = source.dob ?? next.dob;
    } else if (field === "gender") {
      next.gender = source.gender ?? next.gender;
    } else if (field === "cnic") {
      next.cnic = source.cnic ?? next.cnic;
    } else if (field === "phone") {
      next.phone = source.phone ?? next.phone;
      if (source.phones && source.phones.length > 0) {
        next.phones = source.phones;
      }
    } else if (field === "email") {
      next.email = source.email ?? next.email;
      if (source.emails && source.emails.length > 0) {
        next.emails = source.emails;
      }
    } else if (field === "address" || field === "city") {
      next.address = source.address ?? next.address;
      next.city = source.city ?? next.city;
      next.state = source.state ?? next.state;
      next.country = source.country ?? next.country;
      if (source.addresses && source.addresses.length > 0) {
        next.addresses = source.addresses;
      }
    } else if (field === "notes") {
      next.notes = source.notes ?? next.notes;
    } else if (field === "tag") {
      next.tag = source.tag ?? next.tag;
      next.tags = source.tags ?? next.tags;
    }
  }
  return next;
}

export function MergePreview({
  pair,
  keepIndex,
  onClose,
  onConfirm,
  confirming,
}: MergePreviewProps): React.JSX.Element {
  const { prefs } = useContactConfig();
  const { t } = useTranslation();
  const colors = getDuplicateThemeColors(prefs);
  const emptyDash = t("contacts.table.emptyDash");
  const keep = pair.contacts[keepIndex];
  const other = pair.contacts[1 - keepIndex];

  const [fieldOverrides, setFieldOverrides] = useState<Record<string, number>>({});

  const defaultMerged = mergeContacts(keep, other);
  const customMerged = resolveCustomMerged(defaultMerged, fieldOverrides, keep, other);

  const fields = prefs.duplicateDetectionFields || ["name", "phone", "email", "cnic"];

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={t("contacts.duplicates.mergePreview")}
      icon={GitMerge}
      priority
      size="lg"
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="min-h-11 px-4 font-medium"
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            onClick={() => onConfirm(customMerged)}
            disabled={confirming}
            className="flex items-center gap-2 px-5 min-h-11 font-semibold"
          >
            {confirming ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <GitMerge className="w-4 h-4" />
            )}
            <span>{confirming ? t("common.loading") : t("contacts.duplicates.confirmMerge")}</span>
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Alert
          tone="warning"
          density="compact"
          icon={AlertTriangle}
          description={
            <>
              <strong>{getDisplayName(other)}</strong> {t("contacts.duplicates.mergeWarning")}{" "}
              <strong>{getDisplayName(keep)}</strong>.
            </>
          }
        />

        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            {t("contacts.duplicates.mergedResult")}
          </p>
          <DuplicateMergeFieldsList
            fields={fields}
            keep={keep}
            other={other}
            customMerged={customMerged}
            emptyDash={emptyDash}
            fieldOverrides={fieldOverrides}
            setFieldOverrides={setFieldOverrides}
            colors={colors}
            t={t}
          />
        </div>
      </div>
    </Modal>
  );
}
