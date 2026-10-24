import type React from "react";
import { motion } from "framer-motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";

interface ModuleTierMotionProps {
  tier: string;
  className?: string;
  "aria-busy"?: boolean;
  children: React.ReactNode;
}

/** Shared Framer-motion wrapper for module Work/Setup/Reports tiers. */
export function ModuleTierMotion({
  tier,
  className,
  "aria-busy": ariaBusy,
  children,
}: ModuleTierMotionProps): React.JSX.Element {
  const reducedMotion = useReducedMotion();
  return (
    <motion.div
      key={tier}
      initial={reducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.18 }}
      className={className}
      aria-busy={ariaBusy}
    >
      {children}
    </motion.div>
  );
}
