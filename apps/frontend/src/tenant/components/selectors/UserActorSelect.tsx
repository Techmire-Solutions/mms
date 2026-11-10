import { SearchableSelectField } from "@/components/app/SearchableSelectField";
import React from "react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useTranslation } from "@/hooks/useTranslation";
import { useDebounce } from "@/hooks/useDebounce";
import { useUsersPaginated } from "@/tenant/hooks/collections/users";
import type { WorkspaceUser } from "@mms/shared";
import { SELECT_SEARCH_DEBOUNCE_MS } from "./selectSearch";

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
  const debouncedSearch = useDebounce(search, SELECT_SEARCH_DEBOUNCE_MS);
  const [pickedUser, setPickedUser] = React.useState<{ id: string; label: string } | null>(null);
  const usersQuery = useUsersPaginated({ page: 1, limit: 50, search: debouncedSearch });
  const users: WorkspaceUser[] = usersQuery.data?.users ?? [];

  const selectedValue = value || authUser?.id || "";
  const selectOptions = users
    .toSorted((a, b) => (a.name ?? "").localeCompare(b.name ?? ""))
    .map((user) => ({ value: user.id, label: user.name }));
  if (selectedValue && !selectOptions.some((option) => option.value === selectedValue)) {
    selectOptions.unshift({
      value: selectedValue,
      label:
        pickedUser?.id === selectedValue
          ? pickedUser.label
          : selectedValue === authUser?.id
            ? authUser.name || selectedValue
            : selectedValue,
    });
  }

  const placeholder = allowEmpty ? t("registryPerson.selectUser") : undefined;

  const handleChange = (userId: string): void => {
    const user = users.find((candidate) => candidate.id === userId);
    setPickedUser(user ? { id: userId, label: user.name } : null);
    onChange(userId, user?.name);
  };

  return (
    <SearchableSelectField
      id={selectId}
      label={label}
      required={required}
      disabled={disabled}
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
      onChange={handleChange}
      hint={usersQuery.data?.hasMore && !disabled ? t("registryPerson.refineSearch") : undefined}
    />
  );
}
