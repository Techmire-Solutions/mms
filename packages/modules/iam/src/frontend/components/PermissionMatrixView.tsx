import React from "react";
import { Badge, Input } from "@mms/ui";

export interface PermissionMatrixModule {
  id: string;
  label: string;
}

export interface PermissionMatrixViewLabels {
  read: string;
  write: string;
  delete: string;
  none: string;
  searchPlaceholder: string;
}

export interface PermissionMatrixViewProps {
  modules: readonly PermissionMatrixModule[];
  /** `moduleId` → allowed actions. */
  permissions: Readonly<Record<string, readonly string[]>>;
  /** Disables the search input; the matrix itself is always display-only. */
  readOnly?: boolean;
  labels: PermissionMatrixViewLabels;
  search?: string;
  onSearchChange?: (value: string) => void;
}

const ACTIONS = ["read", "write", "delete"] as const;

/** Presentational permission matrix — no hooks, router, API or domain side effects. */
export function PermissionMatrixView({
  modules,
  permissions,
  readOnly = false,
  labels,
  search = "",
  onSearchChange,
}: PermissionMatrixViewProps): React.JSX.Element {
  const query = search.trim().toLowerCase();
  const visible = modules.filter(
    (module) =>
      !query ||
      module.label.toLowerCase().includes(query) ||
      module.id.toLowerCase().includes(query),
  );
  return (
    <div className="space-y-3">
      <Input
        aria-label={labels.searchPlaceholder}
        disabled={readOnly}
        onChange={(event) => onSearchChange?.(event.target.value)}
        placeholder={labels.searchPlaceholder}
        value={search}
      />
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-3 py-2 text-start font-medium" scope="col" />
              {ACTIONS.map((action) => (
                <th className="px-3 py-2 text-start font-medium" key={action} scope="col">
                  {labels[action]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((module) => {
              const allowed = permissions[module.id] ?? [];
              return (
                <tr className="border-t border-border" key={module.id}>
                  <td className="px-3 py-2">{module.label}</td>
                  {ACTIONS.map((action) => (
                    <td className="px-3 py-2" key={action}>
                      <Badge
                        as="span"
                        size="sm"
                        tone={allowed.includes(action) ? "success" : "muted"}
                      >
                        {allowed.includes(action) ? labels[action] : labels.none}
                      </Badge>
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
