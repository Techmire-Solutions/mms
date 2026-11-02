import {
  loadContactsPageForTenant,
  loadContactsSummaryByIdsForTenant,
} from "../../services/contactService.js";
import {
  type Contact,
  type MessagingRecipientsPageResponse,
  type MessagingRecipientsQueryDto,
  type MessagingRecipientsMatchQueryDto,
  type MessagingRecipientsMatchResponseDto,
  type StandardMessagingRecipient,
  MESSAGING_RECIPIENTS_MATCH_LIMIT,
  filterActiveContacts,
  resolveContactFieldConfigSnapshot,
  sanitizeContactsForViewer,
  toMessagingRecipient,
  getDisplayName,
  getPrimaryPhone,
  getPrimaryEmail,
} from "@mms/shared";
import { loadContactFieldConfig } from "../../contacts/use-cases/contactConfigService.js";

const MATCH_PAGE_SIZE = 500;

/**
 * Recipient mapping runs after the contacts viewer sanitizer: a role that cannot
 * read phones/emails/notes in Contacts must not receive them through messaging
 * (A-01/A-02). The snapshot falls back to the seed config when the tenant row is
 * missing, so sanitization never silently turns off.
 */
async function loadViewerSnapshot() {
  return resolveContactFieldConfigSnapshot(await loadContactFieldConfig());
}

function mapRecipients(
  contacts: Contact[],
  viewerRole: string,
  snapshot: Awaited<ReturnType<typeof loadViewerSnapshot>>,
): StandardMessagingRecipient[] {
  const sanitized = sanitizeContactsForViewer(contacts, viewerRole, snapshot);
  return sanitized.map((contact) =>
    toMessagingRecipient(contact, { getDisplayName, getPrimaryPhone, getPrimaryEmail }),
  );
}

function channelFilter(
  recipients: StandardMessagingRecipient[],
  query: Pick<MessagingRecipientsQueryDto, "hasPhone" | "hasEmail">,
): StandardMessagingRecipient[] {
  return recipients.filter(
    (recipient) =>
      (!query.hasPhone || recipient.phone.trim().length > 0) &&
      (!query.hasEmail || (recipient.email ?? "").trim().length > 0),
  );
}

/**
 * Work-tab recipient page under messaging.read.
 *
 * Returns lean `StandardMessagingRecipient` rows — never full contact records —
 * so a messaging-only role cannot read notes/DOB/addresses it has no Contacts
 * access to (A-01).
 */
export async function loadMessagingRecipients(
  workspaceSubdomain: string,
  query: MessagingRecipientsQueryDto,
  viewerRole = "",
): Promise<MessagingRecipientsPageResponse> {
  const subdomain = workspaceSubdomain.trim().toLowerCase();
  const role = query.role ?? "all";
  const gender = query.gender && query.gender !== "all" ? query.gender : undefined;
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 50;
  const search = query.search?.trim() || undefined;

  const reachability = query.hasPhone
    ? { hasPhone: true as const }
    : query.hasEmail
      ? { hasEmail: true as const }
      : { hasReachable: true as const };

  const baseQuery = {
    page,
    limit: pageSize,
    search,
    gender,
    ...reachability,
    // Only names/phones/emails are mapped below; skip the directory child hydrate.
    recipientProjection: true,
  };

  let contactPage;
  if (role === "students") {
    contactPage = await loadContactsPageForTenant(subdomain, {
      ...baseQuery,
      moduleLinkFilter: "students",
    });
  } else if (role === "faculty") {
    contactPage = await loadContactsPageForTenant(subdomain, {
      ...baseQuery,
      moduleLinkFilter: "faculty",
    });
  } else if (role === "staff") {
    contactPage = await loadContactsPageForTenant(subdomain, {
      ...baseQuery,
      moduleLinkFilter: "staff",
    });
  } else if (role === "contacts") {
    contactPage = await loadContactsPageForTenant(subdomain, {
      ...baseQuery,
      moduleLinkFilter: "unlinked",
    });
  } else {
    contactPage = await loadContactsPageForTenant(subdomain, baseQuery);
  }

  const snapshot = await loadViewerSnapshot();
  const recipients = channelFilter(
    mapRecipients(contactPage.contacts as Contact[], viewerRole, snapshot),
    query,
  );

  return {
    recipients,
    total: contactPage.total,
    page: contactPage.page,
    limit: contactPage.limit,
    hasMore: contactPage.hasMore,
  };
}

/**
 * Resolve lean messaging recipients under messaging.read (not contacts.read).
 * Uses the summary hydrate so bank details/attachments are never loaded (A-04).
 */
export async function resolveMessagingRecipients(
  workspaceSubdomain: string,
  ids: string[],
  viewerRole = "",
): Promise<StandardMessagingRecipient[]> {
  if (ids.length === 0) return [];
  const subdomain = workspaceSubdomain.trim().toLowerCase();
  const found = await loadContactsSummaryByIdsForTenant(subdomain, ids);
  const active = filterActiveContacts(found);
  if (active.length === 0) return [];
  return mapRecipients(active, viewerRole, await loadViewerSnapshot());
}

/**
 * Select-all reachable recipients — lean DTOs, server-capped (no FE page-walk).
 */
export async function matchMessagingRecipients(
  workspaceSubdomain: string,
  query: MessagingRecipientsMatchQueryDto,
  viewerRole = "",
): Promise<MessagingRecipientsMatchResponseDto> {
  const limit = MESSAGING_RECIPIENTS_MATCH_LIMIT;
  const listQuery: MessagingRecipientsQueryDto = {
    role: query.role,
    gender: query.gender,
    search: query.search,
    page: 1,
    pageSize: MATCH_PAGE_SIZE,
    hasPhone: query.kind === "phone" ? true : undefined,
    hasEmail: query.kind === "email" ? true : undefined,
  };

  const recipients: StandardMessagingRecipient[] = [];
  let total = 0;
  let page = 1;
  let hasMore = true;

  while (hasMore && recipients.length < limit) {
    const result = await loadMessagingRecipients(
      workspaceSubdomain,
      { ...listQuery, page, pageSize: MATCH_PAGE_SIZE },
      viewerRole,
    );
    total = result.total;
    for (const recipient of result.recipients) {
      if (recipients.length >= limit) break;
      recipients.push(recipient);
    }
    hasMore = result.hasMore && recipients.length < limit;
    page += 1;
  }

  const truncated = total > recipients.length || (hasMore && recipients.length >= limit);
  return { recipients, total, truncated, limit };
}
