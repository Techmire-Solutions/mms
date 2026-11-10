import { SearchableSelectField } from "@/components/app/SearchableSelectField";
import React, { useState } from "react";
import { useStudentsContractList } from "@/tenant/hooks/collections/students";
import { useFacultyContractList } from "@/tenant/hooks/collections/faculty";
import { useTranslation } from "@/hooks/useTranslation";
import { useDebounce } from "@/hooks/useDebounce";
import { SELECT_SEARCH_DEBOUNCE_MS } from "./selectSearch";

/** Dropdown page size — searchable select, not a full dump (refine via search when `hasMore`). */
const PERSON_SELECT_PAGE_SIZE = 50;

export interface RegistryPersonSelectProps {
  kind: "student" | "faculty";
  value: string;
  onChange: (id: string, name?: string) => void;
  onPick?: (id: string, name: string) => void;
  label: string;
  required?: boolean;
  excludeIds?: string[];
  id?: string;
  name?: string;
  searchLabel?: string;
  searchPlaceholder?: string;
  placeholder?: string;
}

interface PersonItem {
  id: string | number;
  name?: string | null;
  employeeId?: string | null;
}

export function RegistryPersonSelect({
  kind,
  value,
  onChange,
  onPick,
  label,
  required = false,
  excludeIds = [],
  id,
  name,
  searchLabel,
  searchPlaceholder,
  placeholder: customPlaceholder,
}: RegistryPersonSelectProps): React.JSX.Element {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, SELECT_SEARCH_DEBOUNCE_MS);
  const [pickedPerson, setPickedPerson] = useState<{ id: string; label: string } | null>(null);

  const studentsEnabled = kind === "student";
  const facultyEnabled = kind === "faculty";

  const studentQuery = useStudentsContractList(
    {
      page: 1,
      limit: PERSON_SELECT_PAGE_SIZE,
      search: debouncedSearch,
    },
    studentsEnabled,
  );

  const facultyQuery = useFacultyContractList(
    {
      page: 1,
      limit: PERSON_SELECT_PAGE_SIZE,
      search: debouncedSearch,
    },
    facultyEnabled,
  );

  const studentPage = studentQuery.data;
  const facultyPage = facultyQuery.data;
  const activeQuery = studentsEnabled ? studentQuery : facultyQuery;

  const rows: readonly PersonItem[] = studentsEnabled
    ? (studentPage?.body?.students ?? [])
    : (facultyPage?.body?.faculty ?? []);

  const hasMore = studentsEnabled
    ? Boolean(studentPage?.body?.hasMore)
    : Boolean(facultyPage?.body?.hasMore);

  const defaultPlaceholder = studentsEnabled
    ? t("registryPerson.selectStudent")
    : t("registryPerson.selectFaculty");

  const options = (() => {
    const excluded = new Set(excludeIds.map(String));
    return rows
      .filter((row) => !excluded.has(String(row.id)))
      .toSorted((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
  })();

  const valueInOptions = options.some((row) => String(row.id) === value);
  const fallbackId = React.useId();
  const sanitizedId = fallbackId.replace(/:/g, "");
  const selectId = id || `person-select-${sanitizedId}`;

  const selectOptions = (() => {
    const list = options.map((row) => {
      const personName = row.name ?? String(row.id);
      const optLabel = row.employeeId ? `${personName} (${row.employeeId})` : personName;
      return { value: String(row.id), label: optLabel };
    });
    if (value && !valueInOptions) {
      list.unshift({
        value,
        label: pickedPerson?.id === value ? pickedPerson.label : value,
      });
    }
    return list;
  })();

  const handleChange = (pickedId: string) => {
    const selected = options.find((row) => String(row.id) === pickedId);
    const selectedName = selected?.name ? String(selected.name) : "";
    if (selected) {
      const personName = selected.name ?? String(selected.id);
      setPickedPerson({
        id: pickedId,
        label: selected.employeeId ? `${personName} (${selected.employeeId})` : personName,
      });
    } else {
      setPickedPerson(null);
    }
    onChange(pickedId, selectedName);
    onPick?.(pickedId, selectedName);
  };

  return (
    <SearchableSelectField
      id={selectId}
      name={name ?? selectId}
      label={label}
      required={required}
      onSearchChange={setSearch}
      searchLabel={searchLabel ?? t("registryPerson.searchPlaceholder")}
      searchPlaceholder={searchPlaceholder ?? t("registryPerson.searchPlaceholder")}
      loadingLabel={t("common.loading")}
      isLoading={activeQuery.isFetching}
      error={activeQuery.isError ? t("errors.state.generic") : undefined}
      onRetry={() => {
        void activeQuery.refetch();
      }}
      retryLabel={t("common.retry")}
      value={value}
      onChange={handleChange}
      options={selectOptions}
      placeholder={customPlaceholder ?? defaultPlaceholder}
      hint={hasMore ? t("registryPerson.refineSearch") : undefined}
    />
  );
}
