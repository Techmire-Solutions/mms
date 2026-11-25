import React, { memo, type ReactNode } from "react";
import { m, type HTMLMotionProps } from "framer-motion";
import { FORM_CARD } from "@mms/ui";
import { CARD_STRIPE_BASE, CARD_STRIPE_INSET } from "../ui/semanticTone.js";
import { useReducedMotion } from "../tenant/index.js";
import { cn } from "@mms/ui";
import { DirectoryCardHeader, type EntityCardHeaderProps } from "@mms/ui/app/DirectoryCardHeader";
import {
  DirectoryCardMetaGrid,
  type EntityCardMetaGridProps,
} from "@mms/ui/app/DirectoryCardMetaGrid";
import { DirectoryCardFooter, type EntityCardFooterProps } from "@mms/ui/app/DirectoryCardFooter";

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
    <m.div
      layout={!reducedMotion}
      variants={reducedMotion ? entityCardVariantsReduced : entityCardVariants}
      className={cn(
        FORM_CARD,
        "p-3 space-y-3 shadow-xs sm:p-4 sm:space-y-4 [contain-intrinsic-size:180px] [content-visibility:auto]",
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
    </m.div>
  );
});

export const EntityCard = Object.assign(EntityCardBase, {
  Header: DirectoryCardHeader,
  MetaGrid: DirectoryCardMetaGrid,
  Footer: DirectoryCardFooter,
});

export type { EntityCardHeaderProps, EntityCardMetaGridProps, EntityCardFooterProps };
