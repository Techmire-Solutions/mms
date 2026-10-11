import React, { useState } from "react";
import { Plus } from "lucide-react";
import type {
  ContactsSavedReport,
  ContactsSavedReportShareScope,
  ContactsWorkDrillDown,
} from "@mms/shared";
import { formatDate, validateContactsSavedReportDrillDown } from "@mms/shared";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import { usePermissions } from "@/tenant/hooks/usePermissions";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useIsAdminViewer } from "@/tenant/hooks/useViewerRole";
import { useContactConfig } from "@/lib/contexts/ContactConfigContext";
import { useContactsSavedReportsSource } from "@/tenant/hooks/collections/contacts";
import { applyContactsWorkDrillDown } from "@/lib/contacts/contactsWorkDrillDown";
import { notify } from "@/lib/notify";
import { ContactsSavedReportsEditor } from "@/tenant/features/reports/components/ContactsSavedReportsEditor";
import { ContactsSavedReportsList } from "@/components/ui/reports/ContactsSavedReportsList";

interface ContactsSavedReportsProps {
  suggestedDrillDown?: ContactsWorkDrillDown;
}

const SHARE_SCOPES: ContactsSavedReportShareScope[] = ["private", "roles", "users", "global"];

/** Contacts module saved reports — logic presets re-run against live data (globle1 §4.4). */
export default function ContactsSavedReports({
  suggestedDrillDown = {},
}: ContactsSavedReportsProps): React.JSX.Element {
  const { t } = useTranslation();
  const { user } = useAuth();

  const { role } = usePermissions();
  const isAdmin = useIsAdminViewer();
  const { genders } = useContactConfig();
  const { reports, isLoading, isError, retry, createReport, deleteReport, runReport } =
    useContactsSavedReportsSource();

  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState("");
  const [search, setSearch] = useState(suggestedDrillDown.search ?? "");
  const [shareScope, setShareScope] = useState<ContactsSavedReportShareScope>("private");
  const [sharedWithUserIds, setSharedWithUserIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const searchLabel = t("contacts.savedReports.searchLabel");

  const shareScopeOptions = (() => {
    const scopes = [...SHARE_SCOPES];
    if (!isAdmin) return scopes.filter((scope) => scope !== "global");
    return scopes;
  })();

  const openSaveDialog = () => {
    setName("");
    setSearch(suggestedDrillDown.search ?? "");
    setShareScope("private");
    setSharedWithUserIds([]);
    setSaveOpen(true);
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    if (shareScope === "users" && sharedWithUserIds.length === 0) {
      notify.error(t("contacts.savedReports.usersRequired"));
      return;
    }
    const drillDown: ContactsWorkDrillDown = {
      ...(search.trim() ? { search: search.trim() } : {}),
    };
    setSaving(true);
    try {
      await createReport({
        name: trimmedName,
        drillDown,
        shareScope,
        ...(shareScope === "roles" && role ? { sharedWithRoles: [role] } : {}),
        ...(shareScope === "users" ? { sharedWithUserIds } : {}),
      });
      notify.success(t("contacts.savedReports.saveSuccess"));
      setSaveOpen(false);
    } catch {
      notify.error(t("settings.serverSaveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleRun = async (report: ContactsSavedReport) => {
    const issues = validateContactsSavedReportDrillDown(report.drillDown, {
      genders: genders,
    });
    if (issues.length > 0) {
      notify.error(t("contacts.savedReports.staleWarningTitle"), {
        description: t("contacts.savedReports.staleWarningDesc", {
          field: issues[0]?.value ?? "",
        }),
      });
    }
    try {
      await runReport(report.id);
      applyContactsWorkDrillDown(report.drillDown);
      notify.info(t("contacts.savedReports.runSuccess"), { description: report.name });
    } catch {
      notify.error(t("settings.serverSaveFailed"));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteReport(id);
      notify.info(t("contacts.savedReports.deleteSuccess"));
    } catch {
      notify.error(t("settings.serverSaveFailed"));
    }
  };

  const formatLastRun = (() => (iso?: string) => {
    if (!iso) return t("contacts.savedReports.neverRun");
    return formatDate(iso);
  })();

  const shareLabel = (scope: ContactsSavedReportShareScope | undefined): string => {
    const key = scope ?? "private";
    return t(
      `contacts.savedReports.shareScope.${key}` as "contacts.savedReports.shareScope.private",
    );
  };

  const canSave = Boolean(user);

  return (
    <div className="space-y-4 border-t border-border/50 pt-6 mt-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-start">
          <h3 className="text-sm font-semibold text-foreground">
            {t("contacts.savedReports.title")}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("contacts.savedReports.subtitle")}
          </p>
        </div>
        {canSave && (
          <Button
            type="button"
            onClick={openSaveDialog}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors shadow-none"
          >
            <Plus className="w-3.5 h-3.5" />
            {t("contacts.savedReports.saveCurrent")}
          </Button>
        )}
      </div>

      <ContactsSavedReportsList
        reports={reports}
        isLoading={isLoading}
        isError={isError}
        genders={genders}
        searchLabel={searchLabel}
        userId={user ? String(user.id) : null}
        role={role}
        isAdmin={isAdmin}
        shareLabel={shareLabel}
        formatLastRun={formatLastRun}
        onRetry={retry}
        onRun={(savedReport) => void handleRun(savedReport)}
        onDelete={(id) => void handleDelete(id)}
      />

      <ContactsSavedReportsEditor
        open={saveOpen}
        name={name}
        search={search}
        shareScope={shareScope}
        shareScopeOptions={shareScopeOptions}
        sharedWithUserIds={sharedWithUserIds}
        saving={saving}
        searchLabel={searchLabel}
        shareLabel={shareLabel}
        onClose={() => setSaveOpen(false)}
        onNameChange={setName}
        onSearchChange={setSearch}
        onShareScopeChange={(value) => {
          setShareScope(value);
          if (value !== "users") setSharedWithUserIds([]);
        }}
        onSharedWithUserIdsChange={setSharedWithUserIds}
        onSave={() => void handleSave()}
      />
    </div>
  );
}
