import React from "react";
import { MessageComposer, type MessageComposerProps } from "@/components/app/MessageComposer";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useBranding } from "@/tenant/hooks/useBranding";
import { useMessagingPreferencesQuery } from "@/tenant/hooks/collections/messaging";
import { TenantMessageComposerRecipientPicker } from "./TenantMessageComposerRecipientPicker";

export type { MessageComposerProps };

export function TenantMessageComposer(props: MessageComposerProps): React.JSX.Element {
  const { user } = useAuth();
  const branding = useBranding();
  const { data: prefs } = useMessagingPreferencesQuery();

  const defaultGateway =
    props.channel === "sms" && prefs?.defaultSmsMode === "device" ? false : true;
  const useServerGateway = props.useServerGateway ?? defaultGateway;
  const defaultDispatchSpeed =
    props.defaultDispatchSpeed ??
    (prefs?.defaultDispatchSpeed as MessageComposerProps["defaultDispatchSpeed"]);

  return (
    <MessageComposer
      {...props}
      user={user}
      madrasaName={branding.madrasaName}
      useServerGateway={useServerGateway}
      defaultDispatchSpeed={defaultDispatchSpeed}
      renderRecipientPicker={(pickerProps) => (
        <TenantMessageComposerRecipientPicker
          {...pickerProps}
          kind={props.channel === "email" ? "email" : "phone"}
        />
      )}
    />
  );
}

export default TenantMessageComposer;
