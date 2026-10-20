import {
  Download,
  Loader2,
  Mail,
  MessageCircle,
  MessageSquare,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";
import type { ReactElement } from "react";
import {
  bulkActionDockActionClassName,
  bulkActionDockDeleteClassName,
  bulkActionDockRestoreClassName,
} from "@/components/app/bulkActionDockStyles";
import { Button } from "@/components/ui/button";

export type BulkSelectionMessageChannel = "whatsapp" | "sms" | "email";

export interface BulkSelectionMessagingActionsProps {
  onChannel: (channel: BulkSelectionMessageChannel) => void;
  labels: {
    whatsapp: string;
    sms: string;
    email?: string;
  };
  /** Channels to render. Omit a channel to hide it. Default: all three. */
  channels?: Partial<Record<BulkSelectionMessageChannel, boolean>>;
}

/**
 * Floating outline WhatsApp / SMS / Email actions for Work bulk bars.
 */
export function BulkSelectionMessagingActions({
  onChannel,
  labels,
  channels = { whatsapp: true, sms: true, email: true },
}: BulkSelectionMessagingActionsProps): ReactElement {
  return (
    <>
      {channels.whatsapp !== false && (
        <Button
          type="button"
          variant="outline"
          onClick={() => onChannel("whatsapp")}
          className={bulkActionDockActionClassName}
        >
          <MessageCircle className="w-3.5 h-3.5 text-success" aria-hidden="true" /> {labels.whatsapp}
        </Button>
      )}
      {channels.sms !== false && (
        <Button
          type="button"
          variant="outline"
          onClick={() => onChannel("sms")}
          className={bulkActionDockActionClassName}
        >
          <MessageSquare className="w-3.5 h-3.5 text-info" aria-hidden="true" /> {labels.sms}
        </Button>
      )}
      {channels.email !== false && labels.email && (
        <Button
          type="button"
          variant="outline"
          onClick={() => onChannel("email")}
          className={bulkActionDockActionClassName}
        >
          <Mail className="w-3.5 h-3.5 text-primary" aria-hidden="true" /> {labels.email}
        </Button>
      )}
    </>
  );
}

export interface BulkSelectionExportActionProps {
  label: string;
  onClick: () => void | Promise<void>;
  /** Export in flight — disables re-entry and shows a spinner. */
  isPending?: boolean;
}

/** Outline export action for Work bulk bars. */
export function BulkSelectionExportAction({
  label,
  onClick,
  isPending = false,
}: BulkSelectionExportActionProps): ReactElement {
  return (
    <Button
      type="button"
      variant="outline"
      disabled={isPending}
      aria-busy={isPending}
      onClick={() => {
        void onClick();
      }}
      className={bulkActionDockActionClassName}
    >
      {isPending ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
      ) : (
        <Download className="w-3.5 h-3.5" aria-hidden="true" />
      )}{" "}
      {label}
    </Button>
  );
}

export interface BulkSelectionRestoreActionProps {
  label: string;
  onClick: () => void;
}

/** Floating outline restore action for soft-delete trash bulk bars. */
export function BulkSelectionRestoreAction({
  label,
  onClick,
}: BulkSelectionRestoreActionProps): ReactElement {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      className={bulkActionDockRestoreClassName}
    >
      <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" /> {label}
    </Button>
  );
}

export interface BulkSelectionDeleteActionProps {
  label: string;
  onClick: () => void;
  /** Optional leading icon (defaults to none). Pass Trash2/Archive as needed. */
  icon?: LucideIcon;
}

/** Destructive delete/trash action for Work bulk bars. */
export function BulkSelectionDeleteAction({
  label,
  onClick,
  icon: Icon,
}: BulkSelectionDeleteActionProps): ReactElement {
  return (
    <Button
      type="button"
      variant="destructive"
      onClick={onClick}
      className={bulkActionDockDeleteClassName}
    >
      {Icon ? <Icon className="w-3.5 h-3.5" aria-hidden="true" /> : null}
      {label}
    </Button>
  );
}

export {
  BulkSelectionStatusAction,
  type BulkSelectionStatusActionProps,
} from "./BulkSelectionStatusAction";

export interface BulkSelectionClearActionProps {
  label: string;
  onClick: () => void;
}

/** Trailing Deselect control for Work bulk bars. */
export function BulkSelectionClearAction({
  label,
  onClick,
}: BulkSelectionClearActionProps): ReactElement {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      className="text-muted-foreground hover:text-foreground font-medium cursor-pointer"
    >
      {label}
    </Button>
  );
}
