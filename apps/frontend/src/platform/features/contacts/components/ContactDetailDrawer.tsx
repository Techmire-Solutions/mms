import React from "react";
import { Pencil, Trash2, Users } from "lucide-react";
import { Badge, Button } from "@mms/ui";
import { DetailDrawerShell } from "@/components/app/DetailDrawerShell";
import { SectionCard } from "@/components/app/SectionCard";
import { useTranslation } from "@/hooks/useTranslation";
import type { PlatformContactDto } from "@mms/contracts";
import { PLATFORM_CONTACT_KIND_LABEL_KEYS } from "@/platform/features/contacts/lib/platformContactKinds";

/** Read-only contact detail drawer with quick edit/delete actions. */
export function ContactDetailDrawer({
  contact,
  onClose,
  onEdit,
  onDelete,
}: {
  contact: PlatformContactDto;
  onClose: () => void;
  onEdit: (contact: PlatformContactDto) => void;
  onDelete: (id: string) => void;
}): React.JSX.Element {
  const { t } = useTranslation();

  const fields: Array<[string, string | null]> = [
    [t("platform.contacts.email"), contact.email ?? "—"],
    [t("platform.contacts.phone"), contact.phone ?? "—"],
    [t("platform.contacts.kind"), t(PLATFORM_CONTACT_KIND_LABEL_KEYS[contact.kind])],
    [t("platform.contacts.notes"), contact.notes ?? "—"],
  ];

  return (
    <DetailDrawerShell
      open
      onClose={onClose}
      title={contact.name}
      subtitle={contact.workspaceId ?? undefined}
      badge={
        <Badge tone="muted" size="sm">
          {t(PLATFORM_CONTACT_KIND_LABEL_KEYS[contact.kind])}
        </Badge>
      }
      icon={Users}
      ariaLabel={contact.name}
      headerActions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" icon={Pencil} onClick={() => onEdit(contact)}>
            {t("common.edit")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={Trash2}
            className="text-destructive"
            onClick={() => onDelete(contact.id)}
          >
            {t("common.delete")}
          </Button>
        </div>
      }
    >
      <SectionCard title={t("platform.contacts.directory")} icon={Users}>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {fields.map(([label, value]) => (
            <div key={label} className="space-y-1">
              <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
              <dd className="text-sm text-foreground">{value}</dd>
            </div>
          ))}
        </dl>
        {(contact.tags?.length ?? 0) > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {contact.tags.map((tag) => (
              <Badge key={tag.id} tone="secondary" size="sm">
                {tag.label}
              </Badge>
            ))}
          </div>
        ) : null}
      </SectionCard>
    </DetailDrawerShell>
  );
}
