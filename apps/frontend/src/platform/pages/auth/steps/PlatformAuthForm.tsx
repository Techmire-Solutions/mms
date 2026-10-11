import React from "react";
import { motion } from "framer-motion";

export interface PlatformAuthFormProps {
  onSubmit: (event: React.FormEvent) => void;
  busy: boolean;
  reducedMotion: boolean;
  children: React.ReactNode;
}

export function PlatformAuthForm({
  onSubmit,
  busy,
  reducedMotion,
  children,
}: PlatformAuthFormProps): React.JSX.Element {
  return (
    <motion.form
      initial={reducedMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      onSubmit={(event) => onSubmit(event)}
      className="space-y-4 text-start"
      noValidate
      aria-busy={busy}
    >
      {children}
    </motion.form>
  );
}
