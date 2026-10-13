import React, { memo, type ReactNode } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { FORM_CARD } from "@/components/ui/formStyles";
import { CARD_STRIPE_BASE, CARD_STRIPE_INSET } from "@/lib/semanticTone";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";
import { EntityCardHeader, type EntityCardHeaderProps } from "./EntityCardHeader";
import { EntityCardMetaGrid, type EntityCardMetaGridProps } from "./EntityCardMetaGrid";
import { EntityCardFooter, type EntityCardFooterProps } from "./EntityCardFooter";

export const entityCardVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.18, ease: "easeOut" as const },
  },
};

export const entityCardVariantsReduced = {
  hidden: { opacity: 1, y: 0 },
  visible: { opacity: 1, y: 0, transition: { duration: 0 } },
};

export interface EntityCardProps extends Omit<HTMLMotionProps<"div">, "children"> {
  isSelected?: boolean;
  reducedMotion?: boolean;
  accentClassName?: string | false | null;
  children: ReactNode;
}

const EntityCardBase = memo(function EntityCardBase({
  isSelected = false,
  reducedMotion: reducedMotionProp,
  accentClassName,
  className,
  children,
  ...motionProps
}: EntityCardProps): React.JSX.Element {
  const hookReducedMotion = useReducedMotion();
  const reducedMotion = reducedMotionProp ?? hookReducedMotion;

  const effectiveAccent =
    accentClassName === false || accentClassName === null
      ? null
      : accentClassName || "bg-primary/50 group-hover:bg-primary";

  return (
    <motion.div
      layout={!reducedMotion}
      variants={reducedMotion ? entityCardVariantsReduced : entityCardVariants}
      className={cn(
        FORM_CARD,
        "p-4 space-y-4 shadow-xs [contain-intrinsic-size:180px] [content-visibility:auto]",
        effectiveAccent && CARD_STRIPE_INSET,
        isSelected
          ? "border-primary/50 bg-primary/5 shadow-xs"
          : "border-foreground/10 hover:border-foreground/20",
        className,
      )}
      style={{
        contain: "content",
        ...motionProps.style,
      }}
      {...motionProps}
    >
      {effectiveAccent ? (
        <div
          aria-hidden="true"
          className={cn(
            CARD_STRIPE_BASE,
            effectiveAccent,
            reducedMotion ? "" : "transition-colors duration-150 ease-out",
          )}
        />
      ) : null}
      {children}
    </motion.div>
  );
});

export const EntityCard = Object.assign(EntityCardBase, {
  Header: EntityCardHeader,
  MetaGrid: EntityCardMetaGrid,
  Footer: EntityCardFooter,
});

export type { EntityCardHeaderProps, EntityCardMetaGridProps, EntityCardFooterProps };
