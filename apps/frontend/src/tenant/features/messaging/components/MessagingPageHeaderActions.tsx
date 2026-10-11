import { Download, Send, Upload } from "lucide-react";
import type { AppTranslationKey } from "@mms/shared";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslation } from "@/hooks/useTranslation";
import { SEMANTIC_TEXT } from "@/lib/semanticTone";
import { MESSAGING_CHANNEL_CONFIG } from "../config";

interface MessagingPageHeaderActionsProps {
  canWrite: boolean;
  canExport?: boolean;
  isExporting?: boolean;
  startingCampaign: boolean;
  onStartCampaign: (channel: "whatsapp" | "sms" | "email") => void;
  onImport?: () => void;
  onExport?: () => void;
}

export function MessagingPageHeaderActions({
  canWrite,
  canExport = true,
  isExporting = false,
  startingCampaign,
  onStartCampaign,
  onImport,
  onExport,
}: MessagingPageHeaderActionsProps): React.JSX.Element | null {
  const { t } = useTranslation();

  if (!canWrite) return null;

  return (
    <div className="flex items-center gap-2">
      {canExport && onExport ? (
        <Button
          variant="ghost"
          icon={Download}
          onClick={onExport}
          loading={isExporting}
          disabled={isExporting}
        >
          {t("common.export")}
        </Button>
      ) : null}
      {onImport ? (
        <Button variant="outline" icon={Upload} onClick={onImport}>
          {t("common.import")}
        </Button>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="primary"
            icon={Send}
            disabled={startingCampaign}
            loading={startingCampaign}
          >
            {t("messaging.newCampaign")}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {Object.values(MESSAGING_CHANNEL_CONFIG).map((config) => (
            <DropdownMenuItem
              key={config.id}
              onClick={() => void onStartCampaign(config.id)}
              className="cursor-pointer gap-2 py-2"
            >
              <config.icon
                className={`h-4 w-4 ${
                  SEMANTIC_TEXT[config.themeAccent as keyof typeof SEMANTIC_TEXT]
                }`}
              />
              <span className="font-medium flex-1">
                {t(config.labelSendKey as AppTranslationKey)}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
