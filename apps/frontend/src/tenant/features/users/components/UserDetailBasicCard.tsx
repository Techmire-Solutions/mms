import React from "react";
import { Shield, AlertTriangle, CheckCircle2, Phone, Mail, Send } from "lucide-react";
import type { SystemUser } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from "@/components/ui/button";
import { DetailSectionCard } from "@/components/app/DetailSectionCard";
import { DetailAttributeRow } from "@/components/app/DetailAttributeRow";

export interface UserDetailBasicCardProps {
  user: SystemUser;
  canMutate: boolean;
  fmtDate: (ts: string) => string;
  onCompose: (channel: "sms" | "whatsapp" | "email") => void;
  onVerifyEmail: () => void;
  verifyEmailPending: boolean;
}

export function UserDetailBasicCard({
  user,
  canMutate,
  fmtDate,
  onCompose,
  onVerifyEmail,
  verifyEmailPending,
}: UserDetailBasicCardProps): React.JSX.Element {
  const { t } = useTranslation();
  const composeChannel = (channel: "sms" | "whatsapp" | "email") => () => onCompose(channel);

  return (
    <DetailSectionCard
      title={t("users.detailBasic")}
      accentColor="info"
      className="divide-y divide-border/50 p-0"
    >
      <DetailAttributeRow
        variant="inset"
        icon={Shield}
        label={t("users.fieldName")}
        value={user.name}
      />
      <DetailAttributeRow
        variant="inset"
        icon={Mail}
        label={t("users.fieldContactEmail")}
        value={
          canMutate ? (
            <div className="flex items-center gap-1.5 justify-end">
              <span>{user.email}</span>
              <Button
                variant="outline"
                type="button"
                size="icon"
                className="rounded-lg border-secondary/30 bg-secondary/5 text-secondary hover:text-secondary hover:bg-secondary/15 hover:border-secondary/40 transition-colors shadow-none cursor-pointer"
                onClick={composeChannel("email")}
                title={t("users.sendEmail")}
                aria-label={t("users.sendEmail")}
              >
                <Mail className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          ) : (
            user.email
          )
        }
      />
      <DetailAttributeRow
        variant="inset"
        icon={Mail}
        label={t("users.fieldLoginEmail")}
        value={
          <div>
            <span>{user.loginEmail?.trim() || user.email}</span>
            {user.loginEmail && user.loginEmail.toLowerCase() !== user.email.toLowerCase() ? (
              <p className="mt-1 text-xs text-muted-foreground">{t("users.loginEmailNote")}</p>
            ) : null}
          </div>
        }
      />
      <DetailAttributeRow
        variant="inset"
        icon={Shield}
        label={t("users.fieldEmailStatus")}
        value={
          user.emailVerifiedAt ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-success font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {t("users.emailVerified")} ({fmtDate(user.emailVerifiedAt)})
            </span>
          ) : (
            <div className="flex items-center justify-end gap-2">
              <span className="inline-flex items-center gap-1 text-xs text-warning font-medium">
                <AlertTriangle className="h-3.5 w-3.5" />
                {t("users.emailUnverified")}
              </span>
              {canMutate && (
                <Button
                  variant="outline"
                  type="button"
                  size="sm"
                  disabled={verifyEmailPending}
                  className="h-7 touch-target-coarse text-xs px-2.5 rounded-lg border-success/40 bg-success/10 text-success hover:bg-success/15 hover:border-success/60 transition-colors shadow-none font-medium cursor-pointer"
                  onClick={onVerifyEmail}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 me-1" />
                  {t("users.actionVerifyEmail")}
                </Button>
              )}
            </div>
          )
        }
      />
      <DetailAttributeRow
        variant="inset"
        icon={Phone}
        label={t("users.fieldPhone")}
        value={
          canMutate && user.phone ? (
            <div className="flex items-center gap-1.5 justify-end">
              <span>{user.phone}</span>
              <Button
                variant="outline"
                type="button"
                size="icon"
                className="rounded-lg border-success/30 bg-success/5 text-success hover:text-success hover:bg-success/15 hover:border-success/40 transition-colors shadow-none cursor-pointer"
                onClick={composeChannel("whatsapp")}
                title={t("contacts.detail.call")}
                aria-label={t("contacts.detail.call")}
              >
                <Phone className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button
                variant="outline"
                type="button"
                size="icon"
                className="rounded-lg border-primary/30 bg-primary/5 text-primary hover:text-primary hover:bg-primary/15 hover:border-primary/40 transition-colors shadow-none cursor-pointer"
                onClick={composeChannel("sms")}
                title={t("users.sendSms")}
                aria-label={t("users.sendSms")}
              >
                <Send className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          ) : (
            user.phone || "—"
          )
        }
      />
      <DetailAttributeRow
        variant="inset"
        icon={Shield}
        label={t("users.detailMemberSince")}
        value={user.createdDate}
      />
      <DetailAttributeRow
        variant="inset"
        icon={Shield}
        label={t("users.colLastLogin")}
        value={fmtDate(user.lastLogin)}
      />
      <DetailAttributeRow
        variant="inset"
        icon={Shield}
        label={t("users.detailSessions")}
        value={user.activeSessions}
      />
    </DetailSectionCard>
  );
}
