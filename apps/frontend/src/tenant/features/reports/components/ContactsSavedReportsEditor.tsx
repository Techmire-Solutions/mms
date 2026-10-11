import React from "react";
import type { ContactsSavedReportShareScope, WorkspaceUser } from "@mms/shared";
import { Checkbox } from "@/components/ui/checkbox";
import { FormModal } from "@/components/ui/FormModal";
import { FORM_INPUT } from "@/components/ui/formStyles";
import { FormSelect } from "@/components/ui/FormSelect";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Field } from "@/components/ui/FormPrimitives";
import { useTranslation } from "@/hooks/useTranslation";
import { useUsersPaginated } from "@/tenant/hooks/collections/users";
import { SearchBar } from "@/components/ui/SearchBar";

interface ContactsSavedReportUserPickerProps {
  value: string[];
  onChange: (userIds: string[]) => void;
}

function ContactsSavedReportUserPicker({
  value,
  onChange,
}: ContactsSavedReportUserPickerProps): React.JSX.Element {
  const { t } = useTranslation();
  const [userSearch, setUserSearch] = React.useState("");
  const usersQuery = useUsersPaginated({ page: 1, limit: 50, search: userSearch });
  const users: WorkspaceUser[] = usersQuery.data?.users ?? [];
  const options = (() =>
    users.slice().sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "")))();

  const valueSet = new Set(value);

  const toggle = (userId: string) => {
    if (valueSet.has(userId)) {
      onChange(value.filter((selectedUserId) => selectedUserId !== userId));
    } else {
      onChange([...value, userId]);
    }
  };

  return (
    <div className="space-y-1.5">
      <Label htmlFor="saved-report-user-search">
        {t("contacts.savedReports.usersPickerLabel")}
      </Label>
      <SearchBar
        id="saved-report-user-search"
        name="savedReportUserSearch"
        value={userSearch}
        onChange={setUserSearch}
        placeholder={t("registryPerson.searchPlaceholder")}
      />
      <div className="max-h-40 overflow-y-auto rounded-lg border border-border divide-y divide-border">
        {options.length === 0 ? (
          <p className="px-3 py-2 text-xs text-muted-foreground">{t("common.loading")}</p>
        ) : (
          options.map((user) => {
            const checkboxId = `saved-report-user-${user.id}`;
            return (
              <div
                key={user.id}
                className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50"
              >
                <Checkbox
                  id={checkboxId}
                  checked={valueSet.has(String(user.id))}
                  onCheckedChange={() => toggle(String(user.id))}
                />
                <label htmlFor={checkboxId} className="truncate cursor-pointer flex-1">
                  {user.name || user.email}
                </label>
              </div>
            );
          })
        )}
      </div>
      {usersQuery.data?.hasMore && (
        <p className="text-xs text-muted-foreground">{t("registryPerson.refineSearch")}</p>
      )}
    </div>
  );
}

interface ContactsSavedReportsEditorProps {
  open: boolean;
  name: string;
  search: string;
  shareScope: ContactsSavedReportShareScope;
  shareScopeOptions: ContactsSavedReportShareScope[];
  sharedWithUserIds: string[];
  saving: boolean;
  searchLabel: string;
  shareLabel: (scope: ContactsSavedReportShareScope | undefined) => string;
  onClose: () => void;
  onNameChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onShareScopeChange: (value: ContactsSavedReportShareScope) => void;
  onSharedWithUserIdsChange: (userIds: string[]) => void;
  onSave: () => void;
}

export function ContactsSavedReportsEditor({
  open,
  name,
  search,
  shareScope,
  shareScopeOptions,
  sharedWithUserIds,
  saving,
  searchLabel,
  shareLabel,
  onClose,
  onNameChange,
  onSearchChange,
  onShareScopeChange,
  onSharedWithUserIdsChange,
  onSave,
}: ContactsSavedReportsEditorProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={t("contacts.savedReports.saveDialogTitle")}
      size="sm"
      cancelLabel={t("common.cancel")}
      saveLabel={t("contacts.savedReports.save")}
      onSave={onSave}
      saving={saving}
      saveDisabled={!name.trim() || (shareScope === "users" && sharedWithUserIds.length === 0)}
      formId="contacts-saved-reports-form"
    >
      <form
        id="contacts-saved-reports-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim() && !(shareScope === "users" && sharedWithUserIds.length === 0)) {
            onSave();
          }
        }}
        className="space-y-4"
      >
        <Field id="saved-report-name" label={t("contacts.savedReports.nameLabel")} required>
          <Input
            id="saved-report-name"
            name="name"
            className={FORM_INPUT}
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder={t("contacts.savedReports.namePlaceholder")}
            required
          />
        </Field>

        <Field id="saved-report-search" label={searchLabel}>
          <Input
            id="saved-report-search"
            name="search"
            className={FORM_INPUT}
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={t("contacts.savedReports.searchPlaceholder")}
          />
        </Field>

        <Field id="saved-report-share-scope" label={t("contacts.savedReports.shareScopeLabel")}>
          <FormSelect
            id="saved-report-share-scope"
            name="shareScope"
            value={shareScope}
            onChange={(value) => onShareScopeChange(value as ContactsSavedReportShareScope)}
            options={shareScopeOptions.map((scope) => ({
              value: scope,
              label: shareLabel(scope),
            }))}
          />
        </Field>
        {shareScope === "users" && (
          <ContactsSavedReportUserPicker
            value={sharedWithUserIds}
            onChange={onSharedWithUserIdsChange}
          />
        )}
      </form>
    </FormModal>
  );
}
