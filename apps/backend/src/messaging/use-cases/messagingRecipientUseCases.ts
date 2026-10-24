import {
  loadContactsByIdsForTenant,
  loadContactsPageForTenant,
} from "../../services/contactService.js";
import {
  type MessagingRecipientsQueryDto,
  type MessagingRecipientsMatchQueryDto,
  type MessagingRecipientsMatchResponseDto,
  type ContactsListPageResult,
  type StandardMessagingRecipient,
  MESSAGING_RECIPIENTS_MATCH_LIMIT,
  filterActiveContacts,
  toMessagingRecipient,
  getDisplayName,
  getPrimaryPhone,
  getPrimaryEmail,
} from "@mms/shared";

const MATCH_PAGE_SIZE = 500;

export async function loadMessagingRecipients(
  workspaceSubdomain: string,
  query: MessagingRecipientsQueryDto,
): Promise<ContactsListPageResult> {
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
  };

  if (role === "students") {
    return loadContactsPageForTenant(subdomain, { ...baseQuery, moduleLinkFilter: "students" });
  }
  if (role === "faculty") {
    return loadContactsPageForTenant(subdomain, { ...baseQuery, moduleLinkFilter: "faculty" });
  }
  if (role === "staff") {
    return loadContactsPageForTenant(subdomain, { ...baseQuery, moduleLinkFilter: "staff" });
  }
  if (role === "contacts") {
    return loadContactsPageForTenant(subdomain, { ...baseQuery, moduleLinkFilter: "unlinked" });
  }

  return loadContactsPageForTenant(subdomain, baseQuery);
}

/**
 * Resolve lean messaging recipients under messaging.read (not contacts.read).
 */
export async function resolveMessagingRecipients(
  workspaceSubdomain: string,
  ids: string[],
): Promise<StandardMessagingRecipient[]> {
  if (ids.length === 0) return [];
  const subdomain = workspaceSubdomain.trim().toLowerCase();
  const found = await loadContactsByIdsForTenant(subdomain, ids);
  return filterActiveContacts(found).map((contact) =>
    toMessagingRecipient(contact, { getDisplayName, getPrimaryPhone, getPrimaryEmail }),
  );
}

/**
 * Select-all reachable recipients — lean DTOs, server-capped (no FE page-walk).
 */
export async function matchMessagingRecipients(
  workspaceSubdomain: string,
  query: MessagingRecipientsMatchQueryDto,
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
    const result = await loadMessagingRecipients(workspaceSubdomain, {
      ...listQuery,
      page,
      pageSize: MATCH_PAGE_SIZE,
    });
    total = result.total;
    for (const contact of result.contacts) {
      if (recipients.length >= limit) break;
      recipients.push(
        toMessagingRecipient(contact, { getDisplayName, getPrimaryPhone, getPrimaryEmail }),
      );
    }
    hasMore = result.hasMore && recipients.length < limit;
    page += 1;
  }

  const truncated = total > recipients.length || (hasMore && recipients.length >= limit);
  return {
    recipients,
    total,
    truncated,
    limit,
  };
}
