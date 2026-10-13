import React from "react";
import { Users } from "lucide-react";
import { motion } from "framer-motion";
import { WORK_SURFACE } from "@/components/ui/formStyles";
import { StatCardBody } from "@/components/app/StatCardBody";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { COLOR_MAP, ICONS_LIST } from "@/lib/reports/pinnedWidgetTypes";
import { CARD_STRIPE_BASE, CARD_STRIPE_INSET } from "@/lib/ui/semanticTone";
import { cn } from "@/lib/utils";
import type { computeCustomCard } from "@/lib/reports/reportMetadata";

type ComputedCustomCard = ReturnType<typeof computeCustomCard>;

interface CustomWidgetCardLayoutProps {
  computedCard: ComputedCustomCard;
}

export function CustomWidgetCardLayout({
  computedCard,
}: CustomWidgetCardLayoutProps): React.JSX.Element {
  const Icon = ICONS_LIST[computedCard.icon || ""] || Users;
  const colorClasses = COLOR_MAP[computedCard.color || ""] || COLOR_MAP.emerald;
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      layout={!reducedMotion}
      whileHover={reducedMotion ? undefined : { y: -4, scale: 1.015 }}
      transition={{ type: "spring", stiffness: 350, damping: 25 }}
      className={cn(
        WORK_SURFACE,
        CARD_STRIPE_INSET,
        "p-5 hover:shadow-surface-lg transition-all relative text-start flex flex-col justify-between min-h-card-compact font-sans overflow-hidden group",
      )}
    >
      <div
        aria-hidden="true"
        className={cn(
          CARD_STRIPE_BASE,
          `${colorClasses.bar}/60 group-hover:${colorClasses.bar} transition-colors duration-300`,
        )}
      />
      <StatCardBody
        colorTheme={colorClasses}
        icon={<Icon className={`w-4.5 h-4.5 ${colorClasses.text}`} />}
        value={computedCard.value}
        title={computedCard.title}
        footer={computedCard.sub}
        trend={computedCard.trend}
      />
    </motion.div>
  );
}
