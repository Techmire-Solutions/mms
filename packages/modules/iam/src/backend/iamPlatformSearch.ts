import { bypassTenantScope } from "@mms/db";
import { assertPlatformIamAccess } from "../shared/policy.js";
import type {
  IamPlatformActor,
  PlatformIamOrgResult,
  PlatformIamSearchPage,
  PlatformIamUserResult,
} from "../shared/types.js";
import type { IamPorts } from "./ports.js";

const USER_SEARCH_LIMIT = 50;
const ORG_SEARCH_LIMIT = 50;

function emptyPage<T>(page: number, limit: number): PlatformIamSearchPage<T> {
  return { items: [], total: 0, page, limit, hasMore: false };
}

function pageOf<T>(
  items: T[],
  page: number,
  limit: number,
  total: number,
): PlatformIamSearchPage<T> {
  const offset = (page - 1) * limit;
  return { items, page, limit, total, hasMore: offset + items.length < total };
}

/** Cross-tenant platform user search (`bypassTenantScope` audited read). */
export async function searchPlatformUsers(
  ports: IamPorts,
  actor: IamPlatformActor,
  query: string,
  page = 1,
  limit = 25,
): Promise<PlatformIamSearchPage<PlatformIamUserResult>> {
  assertPlatformIamAccess(actor);
  const clean = query.trim();
  if (clean.length < 2) return emptyPage(page, limit);
  const capped = Math.min(Math.max(limit, 1), USER_SEARCH_LIMIT);
  const offset = (page - 1) * capped;
  const { items, total } = await bypassTenantScope(
    {
      reason: "platform IAM cross-tenant user search",
      actorId: actor.id,
      auditMeta: { query: clean, page, limit: capped, offset },
    },
    async () => {
      const [rows, count] = await Promise.all([
        ports.platform.searchUsers(clean, capped, offset),
        ports.platform.countUsers(clean),
      ]);
      return { items: rows, total: count };
    },
  );
  return pageOf(items, page, capped, total);
}

/** Cross-tenant platform organization search (`bypassTenantScope` audited read). */
export async function searchPlatformOrganizations(
  ports: IamPorts,
  actor: IamPlatformActor,
  query: string,
  page = 1,
  limit = 25,
): Promise<PlatformIamSearchPage<PlatformIamOrgResult>> {
  assertPlatformIamAccess(actor);
  const clean = query.trim();
  if (clean.length < 2) return emptyPage(page, limit);
  const capped = Math.min(Math.max(limit, 1), ORG_SEARCH_LIMIT);
  const offset = (page - 1) * capped;
  const { items, total } = await bypassTenantScope(
    {
      reason: "platform IAM cross-tenant organization search",
      actorId: actor.id,
      auditMeta: { query: clean, page, limit: capped, offset },
    },
    async () => {
      const [rows, count] = await Promise.all([
        ports.platform.searchOrganizations(clean, capped, offset),
        ports.platform.countOrganizations(clean),
      ]);
      return { items: rows, total: count };
    },
  );
  return pageOf(items, page, capped, total);
}
