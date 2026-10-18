import React from "react";
import { MessageComposer, type MessageComposerProps } from "@/components/app/MessageComposer";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useBranding } from "@/tenant/hooks/useBranding";
import { TenantMessageComposerRecipientPicker } from "./TenantMessageComposerRecipientPicker";

export type { MessageComposerProps };

export function TenantMessageComposer(props: MessageComposerProps): React.JSX.Element {
  const { user } = useAuth();
  const branding = useBranding();

  return (
    <MessageComposer
      {...props}
      user={user}
      madrasaName={branding.madrasaName}
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
