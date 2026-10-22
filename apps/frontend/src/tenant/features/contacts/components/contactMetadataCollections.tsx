import { Globe, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  formatSocialPlatformUrl,
  mergeStoredAndDerivedSiblingLinks,
  type AppTranslationKey,
  type Contact,
} from "@mms/shared";
import { formatLocalizedRelationshipLabel } from "@/lib/contacts/formatLocalizedRelationshipLabel";

export function renderSocialMetadata({
  contact,
  emptyNode,
  t,
}: {
  contact: Contact;
  emptyNode: React.ReactNode;
  t: (key: AppTranslationKey, params?: Record<string, string | number>) => string;
}): React.ReactNode {
  const socials = (contact.socials || []).filter(
    (social) => (social.platform || "").trim().length > 0 || (social.url || "").trim().length > 0,
  );
  if (socials.length === 0) return emptyNode;

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      {socials.map((social, index) => {
        const platform = (social.platform || "").trim();
        const url = (social.url || "").trim();
        const href = url ? formatSocialPlatformUrl(platform, url) : undefined;
        const displayUrl = url ? url.replace(/^https?:\/\//i, "").replace(/\/$/, "") : "";
        const label =
          platform && displayUrl ? `${platform}: ${displayUrl}` : platform || displayUrl;

        if (href) {
          return (
            <a
              key={index}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => event.stopPropagation()}
              className="inline-flex items-center min-h-11 gap-1 px-2 py-0.5 rounded-lg bg-primary/10 hover:bg-primary/15 text-primary border border-primary/20 text-xs font-semibold transition-colors truncate max-w-cell-trunc"
              title={`${platform || t("contacts.form.link")}: ${url}`}
            >
              <Globe className="w-3 h-3 shrink-0 text-primary" />
              <span className="truncate">{label}</span>
              <ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-70" />
            </a>
          );
        }

        return (
          <Badge key={index} as="span" tone="muted" size="sm" className="font-medium gap-1">
            <Globe className="w-3 h-3 shrink-0" />
            <span>{platform || displayUrl}</span>
          </Badge>
        );
      })}
    </div>
  );
}

export function renderRelationshipMetadata({
  contact,
  contactsMap,
  emptyNode,
  renderJoinedList,
  t,
}: {
  contact: Contact;
  contactsMap: Map<string, Contact> | null | undefined;
  emptyNode: React.ReactNode;
  renderJoinedList: (items: (string | undefined | null)[], showTitle?: boolean) => React.ReactNode;
  t: (key: AppTranslationKey, params?: Record<string, string | number>) => string;
}): React.ReactNode {
  const peers = contactsMap ? [...contactsMap.values()] : [];
  const list = mergeStoredAndDerivedSiblingLinks(contact, peers).filter(
    (link) => (link.name || "").trim() || link.contactId || (link.relationship || "").trim(),
  );
  if (list.length === 0) return emptyNode;

  const items = list.map((link) => {
    let name = link.name ? link.name.trim() : "";
    const linked = link.contactId ? contactsMap?.get(String(link.contactId)) : undefined;
    if (!name && link.contactId) {
      name = linked ? linked.name : `${t("contacts.table.contactIdPrefix")}${link.contactId}`;
    }
    const relationship = link.relationship
      ? formatLocalizedRelationshipLabel(link.relationship.trim(), linked?.gender ?? link.gender, t)
      : "";
    if (name && relationship) return `${name} (${relationship})`;
    return name || relationship;
  });

  return renderJoinedList(items.filter(Boolean));
}

export function renderEducationMetadata({
  contact,
  emptyNode,
}: {
  contact: Contact;
  emptyNode: React.ReactNode;
}): React.ReactNode {
  const educations = (contact.education || []).filter(
    (edu) => (edu.degree || "").trim() || (edu.institution || "").trim(),
  );
  if (educations.length === 0) return emptyNode;

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      {educations.map((edu, idx) => (
        <Badge key={edu.id || idx} as="span" tone="primary" size="sm" className="font-normal gap-1">
          {edu.degree ? <span className="font-semibold">{edu.degree}</span> : null}
          {edu.degree && edu.institution ? <span className="opacity-60">·</span> : null}
          <span className="truncate max-w-cell-sm">{edu.institution}</span>
        </Badge>
      ))}
    </div>
  );
}

export function renderExperienceMetadata({
  contact,
  emptyNode,
}: {
  contact: Contact;
  emptyNode: React.ReactNode;
}): React.ReactNode {
  const experiences = (contact.experience || []).filter(
    (exp) => (exp.title || "").trim() || (exp.organization || "").trim(),
  );
  if (experiences.length === 0) return emptyNode;

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      {experiences.map((exp, idx) => (
        <Badge key={exp.id || idx} as="span" tone="primary" size="sm" className="font-normal gap-1">
          {exp.title ? <span className="font-semibold">{exp.title}</span> : null}
          {exp.title && exp.organization ? <span className="opacity-60">·</span> : null}
          <span className="truncate max-w-cell-sm">{exp.organization}</span>
        </Badge>
      ))}
    </div>
  );
}

export function renderSkillsMetadata({
  contact,
  emptyNode,
}: {
  contact: Contact;
  emptyNode: React.ReactNode;
}): React.ReactNode {
  const skills = (contact.skills || []).filter((s) => (s.name || "").trim());
  if (skills.length === 0) return emptyNode;

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      {skills.map((s, idx) => (
        <Badge key={s.id || idx} as="span" tone="primary" size="sm" className="font-normal gap-1">
          <span className="font-semibold">{s.name}</span>
          {s.proficiency ? (
            <>
              <span className="opacity-60">·</span>
              <span className="text-3xs opacity-85">{s.proficiency}</span>
            </>
          ) : null}
        </Badge>
      ))}
    </div>
  );
}
