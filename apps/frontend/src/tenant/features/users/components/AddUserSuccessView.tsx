import React from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import type { AddUserFormState } from "../lib/addUserModalTypes";

export interface AddUserSuccessViewProps {
  form: AddUserFormState;
  t: TranslationFunction;
}

export function AddUserSuccessView({ form, t }: AddUserSuccessViewProps): React.JSX.Element {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center gap-4 py-10 text-center"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
        <Check className="h-8 w-8 text-primary" />
      </div>
      <div>
        <p className="text-base font-bold text-foreground">{t("users.addSuccessTitle")}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {form.setupMethod === "invite"
            ? t("users.addSuccessInvite", { email: form.email })
            : t("users.addSuccessPassword", { name: form.name })}
        </p>
      </div>
    </motion.div>
  );
}
