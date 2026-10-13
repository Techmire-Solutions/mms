import { SearchableSelectField } from "@/components/app/SearchableSelectField";
import React from "react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useTranslation } from "@/hooks/useTranslation";
import { useUsersPaginated } from "@/tenant/hooks/collections/users";
import type { WorkspaceUser } from "@mms/shared";

export interface UserActorSelectProps {
  value: string;
  onChange: (userId: string, userName?: string) => void;
  label: string;
  required?: boolean;
  id?: string;
  allowEmpty?: boolean;
  disabled?: boolean;
}

export function UserActorSelect({
  value,
  onChange,
  label,
  required = false,
  id,
  allowEmpty = false,
  disabled = false,
}: UserActorSelectProps): React.JSX.Element {
  const generatedId = React.useId();
  const selectId = id || generatedId;
  const { t } = useTranslation();
  const { user: authUser } = useAuth();
  const [search, setSearch] = React.useState("");
  const usersQuery = useUsersPaginated({ page: 1, limit: 50, search });
  const users: WorkspaceUser[] = usersQuery.data?.users ?? [];

  const selectedValue = value || authUser?.id || "";
  const selectOptions = users
    .toSorted((a, b) => (a.name ?? "").localeCompare(b.name ?? ""))
    .map((user) => ({ value: user.id, label: user.name }));
  if (selectedValue && !selectOptions.some((option) => option.value === selectedValue)) {
    selectOptions.unshift({
      value: selectedValue,
      label: selectedValue === authUser?.id ? authUser.name || selectedValue : selectedValue,
    });
  }

  const placeholder = allowEmpty ? t("registryPerson.selectUser") : undefined;

  return (
    <SearchableSelectField
      id={selectId}
      label={label}
      required={required}
      disabled={disabled}
      search={search}
      onSearchChange={setSearch}
      searchLabel={t("registryPerson.searchPlaceholder")}
      searchPlaceholder={t("registryPerson.searchPlaceholder")}
      loadingLabel={t("common.loading")}
      isLoading={usersQuery.isFetching}
      error={usersQuery.isError ? t("errors.state.generic") : undefined}
      onRetry={() => {
        void usersQuery.refetch();
      }}
      retryLabel={t("common.retry")}
      value={selectedValue}
      options={selectOptions}
      placeholder={placeholder}
      onChange={(userId) => onChange(userId, users.find((user) => user.id === userId)?.name)}
      hint={usersQuery.data?.hasMore && !disabled ? t("registryPerson.refineSearch") : undefined}
    />
  );
}
