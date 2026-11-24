export const iamTenantKeys = {
  all: ["iam", "tenant"] as const,
  members: (query: Record<string, unknown>) => [...iamTenantKeys.all, "members", query] as const,
  roles: () => [...iamTenantKeys.all, "roles"] as const,
};
