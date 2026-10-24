import { useQuery } from "@tanstack/react-query";
import { fetchSmsIntegration } from "@/lib/smsIntegrationApi";
import { fetchWhatsappIntegration } from "@/lib/whatsappIntegrationApi";
import { fetchEmailIntegration } from "@/lib/emailIntegrationApi";

export interface GatewayStatusItem {
  isConfigured: boolean;
  isConnected: boolean;
  provider?: string;
  sender?: string;
  lastTestOk?: boolean | null;
  lastError?: string | null;
  isLoading: boolean;
}

export interface MessagingGatewaysStatus {
  sms: GatewayStatusItem;
  whatsapp: GatewayStatusItem;
  email: GatewayStatusItem;
  isLoading: boolean;
  hasAnyGateway: boolean;
}

export function useMessagingGatewaysStatus(): MessagingGatewaysStatus {
  const smsQuery = useQuery({
    queryKey: ["sms-integration"],
    queryFn: fetchSmsIntegration,
    staleTime: 60_000,
  });

  const whatsappQuery = useQuery({
    queryKey: ["whatsapp-integration"],
    queryFn: fetchWhatsappIntegration,
    staleTime: 60_000,
  });

  const emailQuery = useQuery({
    queryKey: ["email-integration"],
    queryFn: fetchEmailIntegration,
    staleTime: 60_000,
  });

  const sms: GatewayStatusItem = {
    isConfigured: Boolean(smsQuery.data?.hasCredentials && smsQuery.data?.senderId),
    isConnected: Boolean(smsQuery.data?.connected),
    provider: smsQuery.data?.providerId,
    sender: smsQuery.data?.senderId,
    lastTestOk: smsQuery.data?.lastTestOk,
    lastError: smsQuery.data?.lastError,
    isLoading: smsQuery.isLoading,
  };

  const whatsapp: GatewayStatusItem = {
    isConfigured: Boolean(
      whatsappQuery.data?.hasCredentials &&
      (whatsappQuery.data?.senderId || whatsappQuery.data?.phoneNumberId),
    ),
    isConnected: Boolean(whatsappQuery.data?.connected),
    provider: whatsappQuery.data?.providerId,
    sender: whatsappQuery.data?.senderId || whatsappQuery.data?.phoneNumberId,
    lastTestOk: whatsappQuery.data?.lastTestOk,
    lastError: whatsappQuery.data?.lastError,
    isLoading: whatsappQuery.isLoading,
  };

  const email: GatewayStatusItem = {
    isConfigured: Boolean(emailQuery.data?.hasCredentials && emailQuery.data?.fromAddress),
    isConnected: Boolean(emailQuery.data?.connected),
    provider: emailQuery.data?.providerId,
    sender: emailQuery.data?.fromAddress,
    lastTestOk: emailQuery.data?.lastTestOk,
    lastError: emailQuery.data?.lastError,
    isLoading: emailQuery.isLoading,
  };

  return {
    sms,
    whatsapp,
    email,
    isLoading: smsQuery.isLoading || whatsappQuery.isLoading || emailQuery.isLoading,
    hasAnyGateway: sms.isConfigured || whatsapp.isConfigured || email.isConfigured,
  };
}
