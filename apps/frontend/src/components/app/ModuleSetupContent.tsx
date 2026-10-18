/**
 * @file ModuleSetupContent.tsx
 * @description Full-width shell for module Setup tier panels (Preferences / Sync / etc.).
 */

import React from "react";
import { cn } from "@/lib/utils";

export interface ModuleSetupContentProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Setup cards stretch to the module content width on desktop — no max-width rail.
 */
export function ModuleSetupContent({
  children,
  className,
}: ModuleSetupContentProps): React.JSX.Element {
  return <div className={cn("w-full max-w-none space-y-6 text-start", className)}>{children}</div>;
}
