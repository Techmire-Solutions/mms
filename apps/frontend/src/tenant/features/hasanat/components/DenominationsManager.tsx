import React, { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Edit2, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { type Denomination } from "@/lib/data/hasanatData";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ConfirmAlertDialog } from "@/components/ui/ConfirmAlertDialog";
import { useTranslation } from "@/hooks/useTranslation";
import { DenominationModal } from "@/tenant/features/hasanat/components/DenominationModal";
import { cn } from "@/lib/utils";
import { CARD_STRIPE_BASE, CARD_STRIPE_INSET } from "@/lib/semanticTone";

const MotionCard = motion.create(Card);

export interface DenominationsManagerProps {
  denoms: Denomination[];
  onUpdate: (denoms: Denomination[]) => void | Promise<void>;
  canWrite?: boolean;
}

/**
 * DenominationsManager Component
 *
 * Renders the management interface for reward denominations (such as Silver, Gold, or Platinum cards).
 * Provides options to create new denominations with custom colors and icons, edit existing profiles,
 * toggle active states, and delete unused denominations.
 */
export function DenominationsManager({
  denoms,
  onUpdate,
  canWrite = true,
}: DenominationsManagerProps) {
  const { t } = useTranslation();
  const [showModal, setShowModal] = useState(false);
  const [editDenom, setEditDenom] = useState<Denomination | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Denomination | null>(null);

  const handleSave = async (denomination: Denomination) => {
    const existing = denoms.find((candidate) => candidate.id === denomination.id);
    await onUpdate(
      existing
        ? denoms.map((candidate) => (candidate.id === denomination.id ? denomination : candidate))
        : [...denoms, denomination],
    );
    setShowModal(false);
    setEditDenom(null);
  };

  const toggleActive = (id: string) => {
    void onUpdate(
      denoms.map((denomination) =>
        denomination.id === id ? { ...denomination, active: !denomination.active } : denomination,
      ),
    );
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const targetId = deleteTarget.id;
    await onUpdate(denoms.filter((denomination) => denomination.id !== targetId));
    setDeleteTarget(null);
  };

  return (
    <section aria-label={t("hasanat.denominations.aria")} className="space-y-4">
      <SectionHeader
        noMargin
        title={t("hasanat.denominations.count", { count: denoms.length })}
        actions={
          canWrite && (
            <Button
              type="button"
              onClick={() => {
                setEditDenom(null);
                setShowModal(true);
              }}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 sm:w-auto"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" /> {t("hasanat.denominations.new")}
            </Button>
          )
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {denoms.map((denomination, index) => (
          <MotionCard
            key={denomination.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06 }}
            className={cn("p-4 group", CARD_STRIPE_INSET, !denomination.active && "opacity-60")}
          >
            <div
              aria-hidden="true"
              className={cn(CARD_STRIPE_BASE, "transition-colors duration-300")}
              style={{
                backgroundColor: denomination.active
                  ? denomination.color
                  : "hsl(var(--muted-foreground))",
              }}
            />
            <header
              className="relative mb-3 flex h-16 items-center gap-3 overflow-hidden rounded-xl px-4 text-primary-foreground shadow-md"
              style={{
                background: `linear-gradient(135deg, ${denomination.color}, color-mix(in srgb, ${denomination.color} 60%, transparent))`,
              }}
            >
              <span className="shrink-0 text-3xl" aria-hidden="true">
                {denomination.icon}
              </span>
              <div className="min-w-0">
                <h3 className="m-0 truncate text-sm font-bold">{denomination.name}</h3>
                <p className="m-0 truncate text-xs opacity-80">
                  {t("hasanat.denominations.pointsLabel", { points: denomination.points })}
                </p>
              </div>
              {!denomination.active && (
                <span
                  className="absolute top-2 end-2 text-xs font-bold bg-background/30 text-primary-foreground px-1.5 py-0.5 rounded"
                  aria-label={t("hasanat.denominations.inactive")}
                >
                  {t("hasanat.denominations.inactive")}
                </span>
              )}
            </header>

            <p className="text-sm text-muted-foreground mb-3">
              {denomination.description || t("hasanat.denominations.noDescription")}
            </p>

            <footer className="flex flex-wrap items-center justify-between gap-2">
              <span className="rounded-lg bg-muted px-2 py-1 text-xs font-bold text-foreground">
                {t("hasanat.denominations.ptsShort", { points: denomination.points })}
              </span>
              {canWrite && (
                <div className="flex shrink-0 items-center gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100">
                  <Button
                    variant="ghost"
                    type="button"
                    size="icon"
                    onClick={() => toggleActive(denomination.id)}
                    className="min-h-11 min-w-11 rounded-lg hover:bg-muted text-muted-foreground"
                    title={
                      denomination.active
                        ? t("hasanat.denominations.deactivate")
                        : t("hasanat.denominations.activate")
                    }
                    aria-label={
                      denomination.active
                        ? t("hasanat.denominations.deactivate")
                        : t("hasanat.denominations.activate")
                    }
                  >
                    {denomination.active ? (
                      <ToggleRight className="w-4 h-4 text-primary" aria-hidden="true" />
                    ) : (
                      <ToggleLeft className="w-4 h-4" aria-hidden="true" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    type="button"
                    size="icon"
                    aria-label={t("hasanat.denominations.editNamed", { name: denomination.name })}
                    onClick={() => {
                      setEditDenom(denomination);
                      setShowModal(true);
                    }}
                    className="min-h-11 min-w-11 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                  >
                    <Edit2 className="w-3.5 h-3.5" aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    type="button"
                    size="icon"
                    aria-label={t("hasanat.denominations.deleteNamed", { name: denomination.name })}
                    onClick={() => setDeleteTarget(denomination)}
                    className="min-h-11 min-w-11 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  </Button>
                </div>
              )}
            </footer>
          </MotionCard>
        ))}
      </div>

      {canWrite && (
        <DenominationModal
          open={showModal}
          denom={editDenom}
          onClose={() => {
            setShowModal(false);
            setEditDenom(null);
          }}
          onSave={handleSave}
        />
      )}

      <ConfirmAlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={t("hasanat.trash.deleteTitle")}
        description={t("hasanat.denominations.deleteNamed", { name: deleteTarget?.name ?? "" })}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        destructive
        onConfirm={handleConfirmDelete}
      />
    </section>
  );
}
