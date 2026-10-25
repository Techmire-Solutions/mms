import React from "react";
import { Tag } from "lucide-react";
import { MESSAGING_MODULE_MANIFEST, type MessageTemplate } from "@mms/shared";
import { EmptyState } from "@/components/app/EmptyState";
import { StatusBadge, type StatusBadgeConfigItem } from "@/components/app/StatusBadge";
import { ChannelBadge } from "@/components/app/ChannelBadge";
import { DirectoryEntityCard } from "@/components/app/DirectoryEntityCard";
import { SectionHeader } from "@shared/ui";
import {
  DataTable,
  type DataTableColumn,
  type DataTableFilter,
} from "@/components/common/data-table";
import { useTranslation } from "@/hooks/useTranslation";
import { MessagingTemplateActionButtons } from "./MessagingTemplateActionButtons";

export interface MessagingTemplateListProps {
  templates: MessageTemplate[];
  canWrite: boolean;
  /** Category facet options (without an "all" entry). */
  categoryOptions: { value: string; label: string }[];
  categoryBadgeConfig: Record<string, StatusBadgeConfigItem>;
  onCopy: (body: string) => void;
  onDuplicate: (template: MessageTemplate) => void;
  onEdit: (template: MessageTemplate) => void;
  onDeleteRequest: (id: string) => void;
}

export const MessagingTemplateList = function MessagingTemplateList({
  templates,
  canWrite,
  categoryOptions,
  categoryBadgeConfig,
  onCopy,
  onDuplicate,
  onEdit,
  onDeleteRequest,
}: MessagingTemplateListProps): React.JSX.Element {
  const { t } = useTranslation();
  const templateLabel = (template: MessageTemplate) =>
    template.labelKey ? t(template.labelKey as Parameters<typeof t>[0]) : template.label;
  const categoryOf = (template: MessageTemplate) => template.category || "general";

  const renderActions = (template: MessageTemplate) => (
    <MessagingTemplateActionButtons
      template={template}
      canWrite={canWrite}
      onCopy={onCopy}
      onDuplicate={onDuplicate}
      onEdit={onEdit}
      onDeleteRequest={onDeleteRequest}
    />
  );

  const columns: DataTableColumn<MessageTemplate>[] = [
    {
      id: "label",
      label: t("messaging.templateLabel"),
      fixed: true,
      searchValue: templateLabel,
      render: (template) => (
        <span className="flex items-center gap-1.5 font-semibold text-foreground min-w-0">
          <span className="truncate">{templateLabel(template)}</span>
          {template.channel && template.channel !== "all" && (
            <ChannelBadge channel={template.channel} className="text-xs" />
          )}
        </span>
      ),
    },
    {
      id: "category",
      label: t("messaging.category"),
      searchValue: (template) =>
        categoryBadgeConfig[categoryOf(template)]?.label ?? categoryOf(template),
      render: (template) => (
        <StatusBadge status={categoryOf(template)} config={categoryBadgeConfig} size="sm" />
      ),
    },
    {
      id: "body",
      label: t("messaging.templateCopy"),
      render: (template) => (
        <span className="block truncate text-muted-foreground" title={template.body}>
          {template.body}
        </span>
      ),
    },
  ];

  const filters: DataTableFilter<MessageTemplate>[] = [
    {
      id: "category",
      label: t("messaging.category"),
      options: categoryOptions,
      getValue: categoryOf,
    },
  ];

  return (
    <div className="md:col-span-2">
      <SectionHeader
        align="start"
        icon={<Tag className="w-3.5 h-3.5 text-primary" aria-hidden="true" />}
        title={t("messaging.configuredPresets")}
        subtitle={t("messaging.configuredPresetsDesc")}
      />

      <DataTable
        tableId={`${MESSAGING_MODULE_MANIFEST.moduleId}_templates`}
        label={t("messaging.configuredPresets")}
        searchPlaceholder={t("messaging.search.placeholder")}
        data={templates}
        columns={columns}
        filters={filters}
        renderRowActions={renderActions}
        renderCard={(template) => (
          /* Setup/catalog entity card — DirectoryEntityCard SSOT (do not hand-compose EntityCard). */
          <DirectoryEntityCard
            entity={template}
            canSelect={false}
            className="space-y-3 p-4"
            headerSlot={
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <h4
                    title={templateLabel(template)}
                    className="truncate text-sm font-semibold text-foreground"
                  >
                    {templateLabel(template)}
                  </h4>
                  {template.channel && template.channel !== "all" && (
                    <div className="mt-1">
                      <ChannelBadge channel={template.channel} className="text-xs" />
                    </div>
                  )}
                </div>
                <StatusBadge status={categoryOf(template)} config={categoryBadgeConfig} size="sm" />
              </div>
            }
            actions={renderActions(template)}
          >
            <div className="rounded-lg bg-muted/40 p-2.5">
              <p className="text-xs font-semibold text-muted-foreground">
                {t("messaging.templateCopy")}
              </p>
              <p className="text-xs text-foreground mt-0.5 whitespace-pre-wrap">{template.body}</p>
            </div>
          </DirectoryEntityCard>
        )}
        emptyState={<EmptyState title={t("messaging.noTemplates")} compact variant="dashed" />}
      />
    </div>
  );
};

export default MessagingTemplateList;
