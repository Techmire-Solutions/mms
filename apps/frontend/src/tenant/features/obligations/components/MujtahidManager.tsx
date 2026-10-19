import React, { useState } from "react";
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/app/EmptyState";
import { SectionHeader } from "@shared/ui";
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmAlertDialog } from "@/components/app/ConfirmAlertDialog";
import { MujtahidNameFormModal } from "@/tenant/features/obligations/components/MujtahidNameFormModal";
import { CARD_STRIPE_INSET } from "@/lib/ui/semanticTone";
import { cn } from "@/lib/utils";
import type { MujtahidManagerProps } from "@/tenant/features/obligations/lib/mujtahidManagerTypes";
import { useMujtahidManagerCrud } from "../hooks/useMujtahidManagerCrud";

export type {
  Mujtahid,
  MujtahidRep,
  MujtahidManagerProps,
} from "@/tenant/features/obligations/lib/mujtahidManagerTypes";

/**
 * MujtahidManager component.
 *
 * @param {MujtahidManagerProps} props
 * @returns {React.ReactElement}
 */
export function MujtahidManager({
  mujtahids,
  reps,
  onChangeMujtahids,
  onChangeReps,
}: MujtahidManagerProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const {
    modal,
    setModal,
    deleteMujtahidId,
    setDeleteMujtahidId,
    deleteRepId,
    setDeleteRepId,
    handleSaveMujtahid,
    handleConfirmDeleteMujtahid,
    handleSaveRep,
    handleConfirmDeleteRep,
  } = useMujtahidManagerCrud({
    mujtahids,
    reps,
    onChangeMujtahids,
    onChangeReps,
  });

  return (
    <div className="space-y-4">
      <SectionHeader
        noMargin
        title={
          <span className="m-0 min-w-0 text-sm text-muted-foreground">
            {t("obligations.mujtahids.count", { count: mujtahids.length })}
          </span>
        }
        actions={
          <Button
            type="button"
            onClick={() => setModal({ mode: "add", data: { name: "" } })}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 sm:w-auto"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" /> {t("obligations.mujtahids.add")}
          </Button>
        }
      />

      <section aria-label={t("obligations.mujtahids.listAria")} className="space-y-2">
        {mujtahids.length === 0 && (
          <EmptyState variant="dashed" title={t("obligations.mujtahids.empty")} compact />
        )}
        {mujtahids.map((mujtahid) => {
          const mujtahidReps = reps.filter(
            (representative) => representative.mujtahid_id === mujtahid.id,
          );
          const isOpen = expanded[mujtahid.id];
          return (
            <Card key={mujtahid.id} accentColor="primary" className="group/mujtahid">
              <header
                className={cn(
                  "flex flex-wrap items-center justify-between gap-2 px-5 py-3",
                  CARD_STRIPE_INSET,
                )}
              >
                <Button
                  type="button"
                  onClick={() =>
                    setExpanded((expandedById) => ({
                      ...expandedById,
                      [mujtahid.id]: !expandedById[mujtahid.id],
                    }))
                  }
                  aria-expanded={isOpen}
                  variant="ghost"
                  className="flex h-auto min-h-11 min-w-0 flex-1 items-center gap-2 px-1 text-sm font-semibold text-foreground shadow-none transition-colors hover:bg-transparent hover:text-primary"
                >
                  {isOpen ? (
                    <ChevronDown className="w-4 h-4 shrink-0" aria-hidden="true" />
                  ) : (
                    <ChevronRight className="w-4 h-4 shrink-0" aria-hidden="true" />
                  )}
                  <span title={mujtahid.name} className="min-w-0 truncate">{mujtahid.name}</span>
                  <Badge as="span" pill tone="muted" className="px-1.5 font-bold shrink-0">
                    {t("obligations.mujtahids.repsCount", { count: mujtahidReps.length })}
                  </Badge>
                </Button>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    aria-label={t("obligations.mujtahids.addRepAria", { name: mujtahid.name })}
                    onClick={() =>
                      setModal({ mode: "add-rep", data: { name: "", mujtahid_id: mujtahid.id } })
                    }
                    variant="ghost"
                    className="flex min-h-11 items-center gap-1 rounded-lg px-2 py-2 text-xs font-semibold text-primary shadow-none transition-colors hover:bg-primary/10"
                  >
                    <Plus className="w-3 h-3" aria-hidden="true" />{" "}
                    <span className="hidden sm:inline">{t("obligations.mujtahids.addRep")}</span>
                  </Button>
                  <Button
                    type="button"
                    aria-label={t("obligations.mujtahids.editAria", { name: mujtahid.name })}
                    onClick={() => setModal({ mode: "edit", data: { ...mujtahid } })}
                    variant="outline"
                    size="icon"
                    className="rounded-lg border-info/30 bg-info/5 text-info hover:text-info hover:bg-info/15 hover:border-info/40 shadow-none transition-colors"
                  >
                    <Pencil className="w-4 h-4" aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    aria-label={t("obligations.mujtahids.deleteAria", { name: mujtahid.name })}
                    onClick={() => setDeleteMujtahidId(mujtahid.id)}
                    variant="outline"
                    size="icon"
                    className="rounded-lg border-destructive/30 bg-destructive/5 text-destructive hover:text-destructive hover:bg-destructive/15 hover:border-destructive/40 shadow-none transition-colors"
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </Button>
                </div>
              </header>
              {isOpen && (
                <div className="border-t border-border bg-muted/30">
                  {mujtahidReps.length === 0 ? (
                    <p className="px-6 py-3 text-xs text-muted-foreground m-0">
                      {t("obligations.mujtahids.noReps")}
                    </p>
                  ) : (
                    mujtahidReps.map((representative) => (
                      <div
                        key={representative.id}
                        className="flex min-w-0 items-center justify-between gap-2 border-b border-border px-6 py-2.5 last:border-0"
                      >
                        <span title={representative.name} className="min-w-0 truncate text-sm text-foreground">
                          {representative.name}
                        </span>
                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            type="button"
                            aria-label={t("obligations.mujtahids.repEditAria", {
                              name: representative.name,
                            })}
                            onClick={() =>
                              setModal({ mode: "edit-rep", data: { ...representative } })
                            }
                            variant="outline"
                            size="icon"
                            className="rounded-lg border-info/30 bg-info/5 text-info hover:text-info hover:bg-info/15 hover:border-info/40 shadow-none transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                          </Button>
                          <Button
                            type="button"
                            aria-label={t("obligations.mujtahids.repDeleteAria", {
                              name: representative.name,
                            })}
                            onClick={() => setDeleteRepId(representative.id)}
                            variant="outline"
                            size="icon"
                            className="rounded-lg border-destructive/30 bg-destructive/5 text-destructive hover:text-destructive hover:bg-destructive/15 hover:border-destructive/40 shadow-none transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </section>

      {modal && (modal.mode === "add" || modal.mode === "edit") ? (
        <MujtahidNameFormModal
          title={
            modal.mode === "add"
              ? t("obligations.mujtahids.addTitle")
              : t("obligations.mujtahids.editTitle")
          }
          label={t("obligations.mujtahids.nameLabel")}
          initial={modal.data}
          onSave={handleSaveMujtahid}
          onClose={() => setModal(null)}
        />
      ) : null}
      {modal && (modal.mode === "add-rep" || modal.mode === "edit-rep") ? (
        <MujtahidNameFormModal
          title={
            modal.mode === "add-rep"
              ? t("obligations.mujtahids.repAddTitle")
              : t("obligations.mujtahids.repEditTitle")
          }
          label={t("obligations.mujtahids.repNameLabel")}
          initial={modal.data}
          onSave={handleSaveRep}
          onClose={() => setModal(null)}
        />
      ) : null}

      <ConfirmAlertDialog
        open={Boolean(deleteMujtahidId)}
        onOpenChange={(open) => {
          if (!open) setDeleteMujtahidId(null);
        }}
        title={t("obligations.mujtahids.deleteConfirm")}
        description={t("obligations.mujtahids.deleteConfirm")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        destructive
        onConfirm={handleConfirmDeleteMujtahid}
      />

      <ConfirmAlertDialog
        open={Boolean(deleteRepId)}
        onOpenChange={(open) => {
          if (!open) setDeleteRepId(null);
        }}
        title={t("obligations.mujtahids.repDeleteConfirm")}
        description={t("obligations.mujtahids.repDeleteConfirm")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        destructive
        onConfirm={handleConfirmDeleteRep}
      />
    </div>
  );
}
