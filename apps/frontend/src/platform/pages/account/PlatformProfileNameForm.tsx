import React, { useState } from "react";
import { User } from "lucide-react";
import { Field, FormSubmitActions, Input, SectionCard } from "@shared/ui";
import { useTranslation } from "@/hooks/useTranslation";
import { usePlatformAuth } from "@/platform/lib/PlatformAuthContext";
import { useUpdatePlatformProfileName } from "@/platform/hooks/usePlatformProfile";
import { getPlatformErrorMessage } from "@/platform/lib/platformAuthErrors";
import { getPlatformNameError } from "@/platform/lib/platformValidation";
import { notify } from "@/lib/notify";

export function PlatformProfileNameForm({
  initialName,
  initialPhone,
}: {
  initialName: string;
  initialPhone?: string;
}): React.JSX.Element {
  const { t } = useTranslation();
  const { platformUser } = usePlatformAuth();
  const updateName = useUpdatePlatformProfileName();
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [nameError, setNameError] = useState<string | null>(null);

  // Re-seed the fields during render when the profile props change.
  const [prevInitial, setPrevInitial] = useState({ initialName, initialPhone });
  if (prevInitial.initialName !== initialName || prevInitial.initialPhone !== initialPhone) {
    setPrevInitial({ initialName, initialPhone });
    setName(initialName);
    setPhone(initialPhone ?? "");
  }

  const handleSaveName = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setNameError(null);

    const nameError = getPlatformNameError(name, t);
    if (nameError) {
      setNameError(nameError);
      return;
    }

    try {
      await updateName.mutateAsync({ name, phone: phone.trim() });
      notify.success(t("platform.profileSaved"));
    } catch (err) {
      setNameError(getPlatformErrorMessage(err, t));
    }
  };

  const unchanged = name === platformUser?.name && phone === (platformUser?.phone ?? "");

  return (
    <SectionCard title={t("platform.profileName")} icon={User} accentColor="info">
      <form onSubmit={(event) => void handleSaveName(event)} className="space-y-4 text-start">
        <Field
          label={t("platform.profileName")}
          required
          error={nameError ?? undefined}
          id="platform-profile-name"
        >
          <Input
            id="platform-profile-name"
            name="name"
            autoComplete="name"
            required
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (nameError) setNameError(null);
            }}
            className="min-h-11"
          />
        </Field>
        <Field
          label={t("platform.profilePhone")}
          hint={t("platform.profilePhoneHint")}
          id="platform-profile-phone"
        >
          <Input
            id="platform-profile-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="+923001234567"
            className="min-h-11"
          />
        </Field>
        <FormSubmitActions
          submitLabel={t("platform.profileSave")}
          pending={updateName.isPending}
          disabled={unchanged}
        />
      </form>
    </SectionCard>
  );
}
