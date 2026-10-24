import React from "react";
import { ShieldAlert } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/lib/contexts/AuthContext";
import EntryPageHead, { formatEntryTitle } from "@/components/entry/EntryPageHead";
import { AuthCardShell, AuthPageFrame } from "@/components/entry/AuthPageShell";
import { AuthMutedPanel, AuthStatusHeader } from "@/components/entry/AuthStatusBanner";
import { Button } from "@/components/ui/button";

/** Shown when auth succeeds but the user is not registered in the tenant. */
export default function UserNotRegisteredError(): React.JSX.Element {
  const { t } = useTranslation();
  const { logout } = useAuth();

  return (
    <>
      <EntryPageHead
        title={formatEntryTitle(t("auth.userNotRegistered.title"), t("entry.productName"))}
        description={t("entry.meta.userNotRegistered")}
      />
      <AuthPageFrame>
        <AuthCardShell
          className="max-w-md"
          header={
            <AuthStatusHeader
              icon={ShieldAlert}
              tone="destructive"
              title={t("auth.userNotRegistered.title")}
              description={t("auth.userNotRegistered.message")}
            />
          }
        >
          <div className="space-y-5">
            <AuthMutedPanel>
              <p className="font-medium text-foreground">{t("auth.userNotRegistered.helpIntro")}</p>
              <ul className="mt-2 list-disc space-y-1.5 ps-5 text-muted-foreground">
                <li>{t("auth.userNotRegistered.verifyAccount")}</li>
                <li>{t("auth.userNotRegistered.contactAdmin")}</li>
                <li>{t("auth.userNotRegistered.tryLogout")}</li>
              </ul>
            </AuthMutedPanel>

            <Button
              type="button"
              size="lg"
              className="h-11 w-full rounded-xl font-semibold"
              onClick={() => logout(true)}
            >
              {t("auth.signOut")}
            </Button>
          </div>
        </AuthCardShell>
      </AuthPageFrame>
    </>
  );
}
