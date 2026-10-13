import React from "react";
import { CredentialsResultCard } from "@/components/app/CredentialsResultCard";
import { useTranslation } from "@/hooks/useTranslation";

export interface CreateAdminResultCardProps {
  name: string;
  adminEmail: string;
  initialPassword: string;
}

export function CreateAdminResultCard({
  name,
  adminEmail,
  initialPassword,
}: CreateAdminResultCardProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <CredentialsResultCard
      title={t("platform.adminCreatedSuccess")}
      fields={[
        { label: t("platform.adminNameValue"), value: name },
        { label: t("platform.adminEmailValue"), value: adminEmail },
      ]}
      passwordLabel={t("platform.initialPasswordValue")}
      password={initialPassword}
      copyText={`Name: ${name}\nEmail: ${adminEmail}\nPassword: ${initialPassword}`}
      copyLabel={t("platform.copyAll")}
      hint={t("platform.provideCredentialsHint")}
    />
  );
}
