import React from "react";
import { ModuleWorkTableHeader } from "@/components/app/ModuleWorkTableHeader";
import type { ContactsColumnConfig } from "@/tenant/features/contacts/lib/contactTableTypes";
import type { useTranslation } from "@/hooks/useTranslation";

type Translate = ReturnType<typeof useTranslation>["t"];

export interface ContactsTableHeaderProps {
  columns: ContactsColumnConfig[];
  sortField: string;
  sortDir: "asc" | "desc";
  onSort: (field: string) => void;
  getColumnWidth: (key: string) => number | undefined;
  setColumnWidth: (key: string, width: number) => void;
  allSelected: boolean;
  someSelected: boolean;
  onSelectAll: () => void;
  t: Translate;
}

export function ContactsTableHeader({
  columns,
  sortField,
  sortDir,
  onSort,
  getColumnWidth,
  setColumnWidth,
  allSelected,
  someSelected,
  onSelectAll,
  t,
}: ContactsTableHeaderProps): React.JSX.Element {
  return (
    <ModuleWorkTableHeader
      columns={columns}
      sortField={sortField}
      sortDir={sortDir}
      onSort={onSort}
      getColumnWidth={getColumnWidth}
      setColumnWidth={setColumnWidth}
      selection={{
        allSelected,
        someSelected,
        onSelectAll,
        ariaLabel: allSelected ? t("common.deselect") : t("contacts.table.selectAll"),
      }}
      actionsLabel={t("contacts.table.actions")}
      stickyColumnId="name"
    />
  );
}
