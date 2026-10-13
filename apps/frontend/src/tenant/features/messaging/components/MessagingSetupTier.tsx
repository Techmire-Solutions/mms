import React from "react";
import { MESSAGING_MODULE_MANIFEST, mergeMessageTemplates } from "@mms/shared";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/app/ErrorBoundary";
import { ErrorState } from "@/components/app/ErrorState";
import { ModuleTierMotion } from "@/components/app/ModuleTierMotion";
import { SetupReadOnlyMessage } from "@/components/app/SetupReadOnlyMessage";
import { SubTabBar } from "@/components/app/SubTabBar";
import { useTranslation } from "@/hooks/useTranslation";
import { ConfirmAlertDialog } from "@/components/app/ConfirmAlertDialog";
import { useModuleSetupSubTabs } from "@/lib/setup/useModuleSetupSubTabs";
import { useMessageTemplates } from "../hooks/useMessaging";
import { useMessagingPageOptions } from "../hooks/useMessagingPageOptions";
import { useMessagingTemplateEditor } from "../hooks/useMessagingTemplateEditor";
import { MessagingSetupTemplateForm } from "./MessagingSetupTemplateForm";
import { MessagingTemplateList } from "./MessagingTemplateList";

export interface MessagingSetupTierProps {
  canWrite: boolean;
  canEditSetup: boolean;
  onDeleteRequest: (templateId: string) => void;
}

export const MessagingSetupTier = function MessagingSetupTier({
  canWrite,
  canEditSetup,
  onDeleteRequest,
}: MessagingSetupTierProps): React.JSX.Element {
  const { t } = useTranslation();
  const { templateCategorySelectOptions, channelSelectOptions, categoryBadgeConfig } =
    useMessagingPageOptions();
  const templatesQuery = useMessageTemplates();
  const editor = useMessagingTemplateEditor();
  const {
    formOpen,
    editingId,
    label,
    body,
    category,
    setCategory,
    channel,
    setChannel,
    errors,
    isFormDirty,
    saving,
    saveDisabled,
    resetForm,
    openCreate,
    handleLabelChange,
    handleBodyChange,
    syncBodyTokenErrorOnBlur,
    save,
    handleEdit,
    handleDuplicate,
    handleCopy,
  } = editor;

  const subTabs = useModuleSetupSubTabs({
    initialKey: MESSAGING_MODULE_MANIFEST.setupSubTabs[0] || "templates",
    isDirty: () => isFormDirty,
    onDiscard: resetForm,
  });

  const setupTabs = (() =>
    MESSAGING_MODULE_MANIFEST.setupSubTabs.map((key) => ({
      key,
      label: t("messaging.tabs.templates"),
    })))();
  const templates = (() => mergeMessageTemplates(templatesQuery.templates))();

  if (templatesQuery.isError) {
    return (
      <ErrorState
        title={t("messaging.loadFailed")}
        description={t("messaging.loadFailedHint")}
        onRetry={() => {
          void templatesQuery.refetch();
        }}
      />
    );
  }

  return (
    <ModuleTierMotion tier="setup">
      <ErrorBoundary>
        <div className="space-y-3">
          {!canEditSetup ? (
            <SetupReadOnlyMessage title={t("messaging.setup.readOnly")} />
          ) : (
            <>
              {setupTabs.length > 1 && (
                <SubTabBar
                  tabs={setupTabs}
                  value={subTabs.sub}
                  onChange={subTabs.handleSubTabChange}
                />
              )}
              {subTabs.sub === "templates" && (
                <div className="space-y-3">
                  {canWrite ? (
                    <div className="flex justify-end">
                      <Button type="button" className="min-h-11 gap-1.5" onClick={openCreate}>
                        <Plus className="h-4 w-4" aria-hidden />
                        {t("messaging.createPreset")}
                      </Button>
                    </div>
                  ) : null}
                  <MessagingTemplateList
                    templates={templates}
                    canWrite={canWrite}
                    categoryOptions={templateCategorySelectOptions}
                    categoryBadgeConfig={categoryBadgeConfig}
                    onCopy={(copyBody) => void handleCopy(copyBody)}
                    onDuplicate={(template) => void handleDuplicate(template)}
                    onEdit={handleEdit}
                    onDeleteRequest={onDeleteRequest}
                  />
                  <MessagingSetupTemplateForm
                    open={formOpen}
                    editingId={editingId}
                    label={label}
                    body={body}
                    category={category}
                    channel={channel}
                    templateCategorySelectOptions={templateCategorySelectOptions}
                    channelSelectOptions={channelSelectOptions}
                    errors={errors}
                    saving={saving}
                    saveDisabled={saveDisabled}
                    isDirty={isFormDirty}
                    onReset={resetForm}
                    onSave={() => void save()}
                    onLabelChange={handleLabelChange}
                    onBodyChange={handleBodyChange}
                    onBodyBlur={syncBodyTokenErrorOnBlur}
                    onCategoryChange={setCategory}
                    onChannelChange={setChannel}
                  />
                </div>
              )}

              <ConfirmAlertDialog
                open={subTabs.discardConfirmOpen}
                onOpenChange={(open) => {
                  if (!open) subTabs.clearPendingSubTab();
                }}
                title={t("settings.unsavedChanges")}
                description={t("messaging.setup.discardUnsavedTemplateConfirm")}
                confirmLabel={t("common.yes")}
                cancelLabel={t("common.cancel")}
                destructive
                onConfirm={subTabs.handleConfirmDiscard}
              />
            </>
          )}
        </div>
      </ErrorBoundary>
    </ModuleTierMotion>
  );
};

export default MessagingSetupTier;
