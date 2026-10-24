import React, { useState } from "react";
import { AlertCircle } from "lucide-react";
import {
  DEFAULT_MESSAGING_PREFERENCES,
  type MessagingPreferences,
  type MessageChannel,
  type MessagingSmsDispatchMode,
  type MessagingDispatchSpeed,
} from "@mms/shared";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/app/FormPrimitives";
import { FormSelect } from "@/components/app/FormSelect";
import { Input } from "@/components/ui/input";
import { ModuleSetupSaveFooter } from "@/components/app/ModuleSetupSaveFooter";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import {
  useMessagingPreferencesQuery,
  useMessagingPreferencesMutation,
} from "../hooks/useMessagingSetupConfig";
import { useMessagingGatewaysStatus } from "../hooks/useMessagingGatewaysStatus";
import { MessagingGatewayStatusOverview } from "./MessagingGatewayStatusOverview";

export interface MessagingSetupPreferencesProps {
  canWrite: boolean;
}

export function MessagingSetupPreferences({
  canWrite,
}: MessagingSetupPreferencesProps): React.JSX.Element {
  const { t } = useTranslation();
  const query = useMessagingPreferencesQuery();
  const mutation = useMessagingPreferencesMutation();
  const gateways = useMessagingGatewaysStatus();

  const [prevData, setPrevData] = useState<MessagingPreferences | undefined>(undefined);
  const [draft, setDraft] = useState<MessagingPreferences>(DEFAULT_MESSAGING_PREFERENCES);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);

  if (query.data && query.data !== prevData) {
    setPrevData(query.data);
    setDraft(query.data);
    setDirty(false);
  }

  const update = <K extends keyof MessagingPreferences>(key: K, value: MessagingPreferences[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
    setSaved(false);
  };

  const handleSave = async (): Promise<void> => {
    if (!canWrite) return;
    try {
      await mutation.mutateAsync(draft);
      setDirty(false);
      setSaved(true);
      notify.success(t("messaging.preferences.saveSuccess"));
    } catch {
      notify.error(t("messaging.preferences.saveFailed"));
    }
  };

  const channelOptions = [
    { value: "sms", label: t("messaging.channel.sms") },
    { value: "whatsapp", label: t("messaging.channel.whatsapp") },
    { value: "email", label: t("messaging.channel.email") },
  ];

  const smsModeOptions = [
    { value: "gateway", label: t("messaging.preferences.modeGateway") },
    { value: "device", label: t("messaging.preferences.modeDevice") },
  ];

  const speedOptions = [
    { value: "safe", label: t("messaging.speed.safe") },
    { value: "normal", label: t("messaging.speed.normal") },
    { value: "express", label: t("messaging.speed.express") },
  ];

  const showSmsWarning =
    draft.defaultSmsMode === "gateway" && !gateways.isLoading && !gateways.sms.isConfigured;
  const showWhatsappWarning =
    draft.defaultChannel === "whatsapp" && !gateways.isLoading && !gateways.whatsapp.isConfigured;
  const showEmailWarning =
    draft.defaultChannel === "email" && !gateways.isLoading && !gateways.email.isConfigured;

  return (
    <div className="space-y-4">
      {/* Contextual Advisory Banners */}
      {showSmsWarning && (
        <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-warning" />
          <span>{t("messaging.gateways.smsUnconfiguredWarning")}</span>
        </div>
      )}
      {showWhatsappWarning && (
        <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-warning" />
          <span>{t("messaging.gateways.whatsappUnconfiguredWarning")}</span>
        </div>
      )}
      {showEmailWarning && (
        <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-warning" />
          <span>{t("messaging.gateways.emailUnconfiguredWarning")}</span>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">
            {t("messaging.preferences.title")}
          </CardTitle>
          <CardDescription className="text-xs">{t("messaging.preferences.desc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id="defaultChannel" label={t("messaging.preferences.defaultChannel")}>
              <FormSelect
                id="defaultChannel"
                value={draft.defaultChannel}
                onChange={(val) => update("defaultChannel", val as MessageChannel)}
                options={channelOptions}
                disabled={!canWrite}
              />
            </Field>

            <Field id="defaultSmsMode" label={t("messaging.preferences.defaultSmsMode")}>
              <FormSelect
                id="defaultSmsMode"
                value={draft.defaultSmsMode}
                onChange={(val) => update("defaultSmsMode", val as MessagingSmsDispatchMode)}
                options={smsModeOptions}
                disabled={!canWrite}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id="defaultDispatchSpeed" label={t("messaging.dispatchSpeed")}>
              <FormSelect
                id="defaultDispatchSpeed"
                value={draft.defaultDispatchSpeed}
                onChange={(val) => update("defaultDispatchSpeed", val as MessagingDispatchSpeed)}
                options={speedOptions}
                disabled={!canWrite}
              />
            </Field>

            <Field
              id="defaultCountryCode"
              label={t("messaging.preferences.defaultCountryCode")}
              hint={t("messaging.preferences.defaultCountryCodeHint")}
            >
              <Input
                id="defaultCountryCode"
                value={draft.defaultCountryCode ?? ""}
                onChange={(e) => update("defaultCountryCode", e.target.value.trim())}
                placeholder="+1"
                maxLength={10}
                disabled={!canWrite}
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      <MessagingGatewayStatusOverview />

      {canWrite && (
        <ModuleSetupSaveFooter
          dirty={dirty}
          saving={mutation.isPending}
          saved={saved}
          saveLabel={mutation.isPending ? t("global.saving") : t("common.save")}
          savedLabel={t("settings.savedBadge")}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
