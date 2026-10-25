import type React from "react";
import { ShieldCheck, User } from "lucide-react";
import {
  getPrimaryEmail,
  getPrimaryPhone,
  normalizePhoneInput,
  type TenantUserProfile,
} from "@mms/shared";
import { FormSubmitActions } from "@/components/app/FormSubmitActions";
import { Card, CardContent } from "@/components/ui/card";
import { CardTitleBar } from "@/components/app/CardTitleBar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/app/Alert";
import { useTranslation } from "@/hooks/useTranslation";
import { CARD_STRIPE_INSET } from "@/lib/ui/semanticTone";
import { cn } from "@/lib/utils";

export interface AccountProfileContactTabProps {
  profile: TenantUserProfile;
  name: string;
  phone: string;
  contactEmail: string;
  savingContact: boolean;
  onNameChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onContactEmailChange: (value: string) => void;
  onSaveContact: () => Promise<void>;
}

export function AccountProfileContactTab({
  profile,
  name,
  phone,
  contactEmail,
  savingContact,
  onNameChange,
  onPhoneChange,
  onContactEmailChange,
  onSaveContact,
}: AccountProfileContactTabProps): React.JSX.Element {
  const { t } = useTranslation();

  const originalName = profile.contact?.name ?? "";
  const originalPhone = profile.contact ? (getPrimaryPhone(profile.contact) ?? "") : "";
  const originalEmail = profile.contact ? (getPrimaryEmail(profile.contact) ?? "") : "";
  const contactDirty =
    name !== originalName || phone !== originalPhone || contactEmail !== originalEmail;

  return (
    <Card accentColor="primary" className="group/profile-card">
      <CardTitleBar
        inset
        icon={<User className="h-4 w-4 text-primary" />}
        title={t("account.contactSection")}
        subtitle={t("account.contactSectionDesc")}
      />
      <CardContent className={cn("pt-5 space-y-4", CARD_STRIPE_INSET)}>
        {!profile.contact ? (
          <Alert
            icon={ShieldCheck}
            title={t("account.unlinkedTitle")}
            description={t("account.noContact")}
            className="items-start"
          />
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void onSaveContact();
            }}
            className="space-y-4"
          >
            <div className="space-y-1 text-start">
              <Label htmlFor="profile-name" className="text-xs font-semibold text-muted-foreground">
                {t("account.fieldName")}
              </Label>
              <Input
                id="profile-name"
                name="profileName"
                value={name}
                onChange={(event) => onNameChange(event.target.value)}
                required
                autoComplete="name"
                className="min-h-11"
              />
            </div>
            <div className="space-y-1 text-start">
              <Label
                htmlFor="profile-phone"
                className="text-xs font-semibold text-muted-foreground"
              >
                {t("account.fieldPhone")}
              </Label>
              <Input
                id="profile-phone"
                name="profilePhone"
                type="tel"
                value={phone}
                onChange={(event) => onPhoneChange(event.target.value)}
                onBlur={() => onPhoneChange(normalizePhoneInput(phone))}
                required
                autoComplete="tel"
                className="min-h-11"
              />
            </div>
            <div className="space-y-1 text-start">
              <Label
                htmlFor="profile-contact-email"
                className="text-xs font-semibold text-muted-foreground"
              >
                {t("account.contactEmail")}
              </Label>
              <Input
                id="profile-contact-email"
                name="profileContactEmail"
                type="email"
                value={contactEmail}
                onChange={(event) => onContactEmailChange(event.target.value)}
                required
                autoComplete="email"
                className="min-h-11"
              />
              <p className="text-xs text-muted-foreground mt-1">{t("account.contactEmailHint")}</p>
            </div>
            <FormSubmitActions
              submitLabel={t("account.saveContact")}
              pending={savingContact}
              disabled={!contactDirty}
            />
          </form>
        )}
      </CardContent>
    </Card>
  );
}
