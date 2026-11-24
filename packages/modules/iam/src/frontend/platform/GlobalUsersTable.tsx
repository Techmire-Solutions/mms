import React from "react";
import { Button, Card, Input } from "@mms/ui";
import { RoleBadge } from "../components/RoleBadge.js";
import { UserAvatar } from "../components/UserAvatar.js";
import { useGlobalOrganizations, useGlobalUsers } from "./hooks/useGlobalUsers.js";

export interface GlobalUsersTableLabels {
  title: string;
  searchPlaceholder: string;
  users: string;
  organizations: string;
  empty: string;
  loading: string;
  error: string;
  /** Row action label; kept in the label bag so the module ships no copy. */
  impersonate: string;
}

export interface GlobalUsersTableProps {
  labels: GlobalUsersTableLabels;
  onImpersonate?: (input: { tenant: string; userId: string; name: string }) => void;
}

/** Cross-tenant search surface for platform operators. */
export function GlobalUsersTable({
  labels,
  onImpersonate,
}: GlobalUsersTableProps): React.JSX.Element {
  const [query, setQuery] = React.useState("");
  const users = useGlobalUsers(query);
  const orgs = useGlobalOrganizations(query);

  return (
    <Card className="space-y-4 p-4">
      <h2 className="text-lg font-semibold">{labels.title}</h2>
      <Input
        aria-label={labels.searchPlaceholder}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={labels.searchPlaceholder}
        value={query}
      />
      {users.isPending || orgs.isPending ? (
        <p className="text-sm text-muted-foreground">{labels.loading}</p>
      ) : null}
      {users.isError || orgs.isError ? (
        <p className="text-sm text-destructive">{labels.error}</p>
      ) : null}
      <section className="space-y-2">
        <h3 className="text-sm font-medium">{labels.users}</h3>
        {query.trim().length >= 2 && (users.data?.items.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">{labels.empty}</p>
        ) : null}
        <ul className="divide-y divide-border">
          {(users.data?.items ?? []).map((row) => (
            <li
              className="flex items-center justify-between gap-3 py-2"
              key={`${row.tenant}:${row.user.id}`}
            >
              <div className="flex min-w-0 items-center gap-2">
                <UserAvatar name={row.user.name} size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{row.user.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {row.tenant} · {row.user.email}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <RoleBadge label={row.user.role} roleId={row.user.role} />
                {onImpersonate && row.user.status === "active" ? (
                  <Button
                    className="min-h-11"
                    onClick={() =>
                      onImpersonate({
                        tenant: row.tenant,
                        userId: row.user.id,
                        name: row.user.name,
                      })
                    }
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    {labels.impersonate}
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section className="space-y-2">
        <h3 className="text-sm font-medium">{labels.organizations}</h3>
        <ul className="divide-y divide-border">
          {(orgs.data?.items ?? []).map((org) => (
            <li className="flex items-center justify-between gap-3 py-2" key={org.subdomain}>
              <span className="text-sm">{org.madrasaName}</span>
              <span className="text-xs text-muted-foreground">{org.subdomain}</span>
            </li>
          ))}
        </ul>
      </section>
    </Card>
  );
}
