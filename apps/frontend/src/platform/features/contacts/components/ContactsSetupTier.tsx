import React from "react";
import { Settings } from "lucide-react";
import { SectionCard } from "@/components/app/SectionCard";
import { useTranslation } from "@/hooks/useTranslation";

/** Contacts → Setup: directory configuration (tags are managed per contact). */
export function ContactsSetupTier(): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <SectionCard
      title={t("platform.contacts.setupTitle")}
      subtitle={t("platform.contacts.setupDesc")}
      icon={Settings}
    >
      <p className="text-sm text-muted-foreground">{t("platform.contacts.setupHint")}</p>
    </SectionCard>
  );
}
