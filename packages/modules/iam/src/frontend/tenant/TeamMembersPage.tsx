import React from "react";
import { Button, Card, Input } from "@mms/ui";
import { RoleBadge } from "../components/RoleBadge";
import { UserAvatar } from "../components/UserAvatar";
import { useTeamMembers } from "./hooks/useTeamMembers";
import type { IamMemberSummary } from "../../shared/types.js";

export interface TeamMembersPageLabels {
  title: string;
  subtitle: string;
  searchPlaceholder: string;
  empty: string;
  invite: string;
  loading: string;
  error: string;
  platformManaged: string;
}

export interface TeamMembersPageProps {
  labels: TeamMembersPageLabels;
  onInvite?: () => void;
  onOpenMember?: (member: IamMemberSummary) => void;
}

/**
 * Customer-facing team members view. It owns the core IAM list composition and
 * leaves shell chrome/advanced tabs to the app route wrapper.
 */
export function TeamMembersPage({
  labels,
  onInvite,
  onOpenMember,
}: TeamMembersPageProps): React.JSX.Element {
  const { data, isPending, isError } = useTeamMembers();
  const [query, setQuery] = React.useState("");
  const members = (data?.users ?? []).filter((member) => {
    const q = query.trim().toLowerCase();
    return !q || member.name.toLowerCase().includes(q) || member.email.toLowerCase().includes(q);
  });

  return (
    <Card className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{labels.title}</h2>
          <p className="text-sm text-muted-foreground">{labels.subtitle}</p>
        </div>
        {onInvite ? <Button onClick={onInvite}>{labels.invite}</Button> : null}
      </div>
      <Input
        aria-label={labels.searchPlaceholder}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={labels.searchPlaceholder}
        value={query}
      />
      {isPending ? <p className="text-sm text-muted-foreground">{labels.loading}</p> : null}
      {isError ? <p className="text-sm text-destructive">{labels.error}</p> : null}
      {!isPending && !isError && members.length === 0 ? (
        <p className="text-sm text-muted-foreground">{labels.empty}</p>
      ) : null}
      <ul className="divide-y divide-border">
        {members.map((member) => {
          const identity = (
            <>
              <UserAvatar name={member.name} size="sm" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{member.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{member.email}</span>
              </span>
            </>
          );
          return (
            <li className="flex items-center justify-between gap-3 py-3" key={member.id}>
              {onOpenMember ? (
                <button
                  className="flex min-w-0 items-center gap-2 text-start"
                  onClick={() => onOpenMember(member)}
                  type="button"
                >
                  {identity}
                </button>
              ) : (
                <div className="flex min-w-0 items-center gap-2">{identity}</div>
              )}
              <RoleBadge
                label={member.role}
                platformManaged={member.role === "super_admin"}
                platformManagedLabel={labels.platformManaged}
                roleId={member.role}
              />
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
