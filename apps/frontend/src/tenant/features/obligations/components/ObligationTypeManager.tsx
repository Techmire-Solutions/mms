import React, { useState } from "react";
import { Plus } from "lucide-react";
import { generateClientEntityId, type ObligationType } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { SEMANTIC_BADGE } from "@/lib/ui/semanticTone";
import { Button } from "@/components/ui/button";
import { ConfirmAlertDialog } from "@/components/app/ConfirmAlertDialog";
import { SectionHeader } from "@shared/ui";
import { ObligationTypeFormModal } from "@/tenant/features/obligations/components/ObligationTypeFormModal";
import { ObligationTypeManagerList } from "@/tenant/features/obligations/components/ObligationTypeManagerList";
import {
  DESIGNATED_LABEL_KEYS,
  OBLIGATION_TYPE_EMPTY,
  type ObligationTypeModalState,
} from "@/tenant/features/obligations/lib/obligationTypeManagerShared";
import type { StatusBadgeConfigItem } from "@/components/app/StatusBadge";

export type { DesignatedFor } from "@/tenant/features/obligations/lib/obligationTypeManagerShared";

export interface ObligationTypeManagerProps {
  types: ObligationType[];
  onChange: (types: ObligationType[]) => void | Promise<void>;
}

/**
 * Setup manager for obligation types.
 */
export function ObligationTypeManager({ types, onChange }: ObligationTypeManagerProps) {
  const { t } = useTranslation();
  const [modal, setModal] = useState<ObligationTypeModalState | null>(null);

  const designatedConfig = (() => ({
    Syed: { label: t(DESIGNATED_LABEL_KEYS.Syed), cls: SEMANTIC_BADGE.info },
    "Non-Syed": { label: t(DESIGNATED_LABEL_KEYS["Non-Syed"]), cls: SEMANTIC_BADGE.warning },
    Both: { label: t(DESIGNATED_LABEL_KEYS.Both), cls: SEMANTIC_BADGE.success },
    None: { label: t(DESIGNATED_LABEL_KEYS.None), cls: SEMANTIC_BADGE.muted },
  }))() as Record<string, StatusBadgeConfigItem>;

  const quantityConfig = (() => ({
    yes: { label: t("common.yes"), cls: SEMANTIC_BADGE.successStrong },
    no: { label: t("common.no"), cls: SEMANTIC_BADGE.muted },
  }))() as Record<string, StatusBadgeConfigItem>;

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const handleSave = async (form: Partial<ObligationType>) => {
    if (modal?.mode === "add") {
      const id = generateClientEntityId("ot");
      await onChange([
        ...types,
        {
          ...form,
          id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as ObligationType,
      ]);
    } else if (modal?.mode === "edit") {
      await onChange(
        types.map((obligationType) =>
          obligationType.id === form.id
            ? { ...obligationType, ...form, updated_at: new Date().toISOString() }
            : obligationType,
        ),
      );
    }
    setModal(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetId) return;
    await onChange(types.filter((obligationType) => obligationType.id !== deleteTargetId));
    setDeleteTargetId(null);
  };

  return (
    <div className="space-y-4">
      <SectionHeader
        noMargin
        title={
          <span className="m-0 min-w-0 text-sm text-muted-foreground">
            {t("obligations.types.count", { count: types.length })}
          </span>
        }
        actions={
          <Button
            type="button"
            size="sm"
            onClick={() => setModal({ mode: "add", data: { ...OBLIGATION_TYPE_EMPTY } })}
            className="flex w-full items-center justify-center gap-1.5 font-semibold sm:w-auto"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" /> {t("obligations.types.add")}
          </Button>
        }
      />

      <ObligationTypeManagerList
        types={types}
        designatedConfig={designatedConfig}
        quantityConfig={quantityConfig}
        onEdit={(obligationType) => setModal({ mode: "edit", data: { ...obligationType } })}
        onDelete={(obligationTypeId) => setDeleteTargetId(obligationTypeId)}
      />

      {modal ? (
        <ObligationTypeFormModal
          title={
            modal.mode === "add"
              ? t("obligations.types.addTitle")
              : t("obligations.types.editTitle")
          }
          initial={modal.data}
          onSave={(form) => {
            void handleSave(form);
          }}
          onClose={() => setModal(null)}
        />
      ) : null}

      <ConfirmAlertDialog
        open={Boolean(deleteTargetId)}
        onOpenChange={(open) => {
          if (!open) setDeleteTargetId(null);
        }}
        title={t("obligations.types.deleteConfirm")}
        description={t("obligations.types.deleteConfirm")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        destructive
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
