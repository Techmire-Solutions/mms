import React, { useMemo } from "react";
import { Lock } from "lucide-react";
import {
  getContactTags,
  normalizeContactTagName,
  type Contact,
  type ContactSystemTag,
} from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface ContactTagBadgeProps {
  tag: string;
  /** Server-owned metadata for module-managed tags; `null`/omitted for manual tags. */
  system?: ContactSystemTag | null;
  size?: BadgeProps["size"];
  className?: string;
}

/**
 * One contact tag chip. Manual tags keep the primary tone; module-managed tags render
 * muted + outlined with a lock and a translated accessible label.
 */
export function ContactTagBadge({
  tag,
  system,
  size = "sm",
  className,
}: ContactTagBadgeProps): React.JSX.Element {
  const { t } = useTranslation();

  if (!system) {
    return (
      <Badge as="span" tone="primary" size={size} className={cn("font-medium", className)}>
        {tag}
      </Badge>
    );
  }

  const managedLabel = system.archived
    ? `${t("contacts.tags.systemManaged")} · ${t("contacts.tags.archived")}`
    : t("contacts.tags.systemManaged");
  const accessibleLabel = `${tag} · ${managedLabel}`;

  return (
    <Badge
      as="span"
      tone="muted"
      variant="outline"
      size={size}
      aria-label={accessibleLabel}
      title={accessibleLabel}
      className={cn(
        "gap-1 border-border font-medium",
        system.archived && "border-dashed bg-muted/40 text-muted-foreground/70",
        className,
      )}
    >
      <Lock className="h-3 w-3 shrink-0" aria-hidden />
      <span>{tag}</span>
    </Badge>
  );
}

export interface ContactTagListProps {
  contact: Pick<Contact, "tag" | "tags" | "systemTags"> | null | undefined;
  size?: BadgeProps["size"];
  className?: string;
}

/** Renders every tag on a contact, resolving system metadata by normalized name. */
export function ContactTagList({
  contact,
  size = "sm",
  className,
}: ContactTagListProps): React.JSX.Element | null {
  const tags = useMemo(() => {
    const names = getContactTags(contact);
    const seen = new Set(names.map(normalizeContactTagName));
    for (const systemTag of contact?.systemTags ?? []) {
      const key = normalizeContactTagName(systemTag.name);
      if (seen.has(key)) continue;
      seen.add(key);
      names.push(systemTag.name);
    }
    return names;
  }, [contact]);

  const systemByName = useMemo(() => {
    const lookup = new Map<string, ContactSystemTag>();
    for (const systemTag of contact?.systemTags ?? []) {
      lookup.set(normalizeContactTagName(systemTag.name), systemTag);
    }
    return lookup;
  }, [contact]);

  if (tags.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {tags.map((tag) => (
        <ContactTagBadge
          key={tag}
          tag={tag}
          system={systemByName.get(normalizeContactTagName(tag)) ?? null}
          size={size}
        />
      ))}
    </div>
  );
}
