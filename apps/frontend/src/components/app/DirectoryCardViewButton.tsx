import React from "react";
import { motion } from "framer-motion";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";

const MotionButton = motion.create(Button);

export interface EntityCardViewButtonProps {
  label: string;
  ariaLabel: string;
  onClick: () => void;
  className?: string;
}

/** Shared outline View control for Work directory entity card footers. */
export const DirectoryCardViewButton = function DirectoryCardViewButton({
  label,
  ariaLabel,
  onClick,
  className,
}: EntityCardViewButtonProps): React.JSX.Element {
  const reducedMotion = useReducedMotion();
  const scaleHover = reducedMotion ? 1 : 1.02;
  const scaleTap = reducedMotion ? 1 : 0.98;

  return (
    <MotionButton
      type="button"
      variant="capsOutline"
      size="caps"
      whileHover={{ scale: scaleHover }}
      whileTap={{ scale: scaleTap }}
      onClick={onClick}
      className={cn("dark:border-border/30", className)}
      aria-label={ariaLabel}
    >
      <Eye aria-hidden="true" className="w-3.5 h-3.5" />
      <span>{label}</span>
    </MotionButton>
  );
};
