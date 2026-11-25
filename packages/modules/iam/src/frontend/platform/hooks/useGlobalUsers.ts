import { useQuery } from "@tanstack/react-query";
import { apiJson } from "@mms/fe-core/api";
import type {
  PlatformIamOrgResult,
  PlatformIamSearchPage,
  PlatformIamUserResult,
} from "../../../shared/types.js";

export const iamPlatformKeys = {
  all: ["iam", "platform"] as const,
  users: (query: string) => [...iamPlatformKeys.all, "users", query] as const,
  organizations: (query: string) => [...iamPlatformKeys.all, "organizations", query] as const,
};

export function useGlobalUsers(query: string) {
  return useQuery({
    queryKey: iamPlatformKeys.users(query),
    enabled: query.trim().length >= 2,
    queryFn: () =>
      apiJson<PlatformIamSearchPage<PlatformIamUserResult>>(
        `/api/platform/iam/users?q=${encodeURIComponent(query.trim())}`,
      ),
  });
}

export function useGlobalOrganizations(query: string) {
  return useQuery({
    queryKey: iamPlatformKeys.organizations(query),
    enabled: query.trim().length >= 2,
    queryFn: () =>
      apiJson<PlatformIamSearchPage<PlatformIamOrgResult>>(
        `/api/platform/iam/organizations?q=${encodeURIComponent(query.trim())}`,
      ),
  });
}
