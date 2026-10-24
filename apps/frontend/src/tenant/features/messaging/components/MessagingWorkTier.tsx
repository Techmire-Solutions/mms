import React from "react";
import type { Message } from "@mms/shared";
import { MessagingWorkTierDirectory } from "./MessagingWorkTierDirectory";
import { useMessagingWorkTierController } from "../hooks/useMessagingWorkTierController";

export type MessagingSelectedLogsMap = Record<string, Message>;

interface MessagingWorkTierProps {
  canWrite: boolean;
  canClearLogs: boolean;
  onClearLogsRequest: () => void;
  onResend: Parameters<typeof useMessagingWorkTierController>[0]["onResend"];
  onBulkResend?: Parameters<typeof useMessagingWorkTierController>[0]["onBulkResend"];
  channel?: Parameters<typeof useMessagingWorkTierController>[0]["channel"];
  onChannelChange?: Parameters<typeof useMessagingWorkTierController>[0]["onChannelChange"];
  onStartCampaign?: (channel: "whatsapp" | "sms" | "email") => void;
}

export function MessagingWorkTier(props: MessagingWorkTierProps): React.JSX.Element {
  const controller = useMessagingWorkTierController(props);

  return (
    <MessagingWorkTierDirectory
      {...controller}
      canWrite={props.canWrite}
      canClearLogs={props.canClearLogs}
      onClearLogsRequest={props.onClearLogsRequest}
      onStartCampaign={props.onStartCampaign}
    />
  );
}
