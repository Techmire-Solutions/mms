import React from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { User, Shield } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { usePlatformProfile } from "@/platform/hooks/usePlatformProfile";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { SubTabBar, type SubTab } from "@/components/ui/SubTabBar";
import { CardSkeleton } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import { ModulePageShell } from "@/components/ui/ModulePageShell";

import { containerVariants, itemVariants as cardVariants } from "@/platform/lib/animations";
import { PlatformProfileCard } from "./account/PlatformProfileCard";
import { PlatformProfileNameForm } from "./account/PlatformProfileNameForm";
import { PlatformProfilePasswordForm } from "./account/PlatformProfilePasswordForm";

type AccountTab = "profile" | "security";

/**
 * Platform operator account hub — Profile information and security password management.
 */
export default function PlatformAccount(): React.JSX.Element {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    data: profile,
    isLoading: loadingProfile,
    isError: profileError,
    refetch,
  } = usePlatformProfile();

  const rawTab = searchParams.get("tab");
  const activeTab: AccountTab = rawTab === "security" ? "security" : "profile";

  const handleTabChange = (nextTab: AccountTab) => {
    setSearchParams({ tab: nextTab }, { replace: true });
  };

  const tabs: SubTab<AccountTab>[] = [
    { key: "profile", label: t("platform.myAccount"), icon: User },
    { key: "security", label: t("auth.password"), icon: Shield },
  ];

  return (
    <ModulePageShell
      seoTitle={`${t("platform.profileTitle")} | ${t("platform.consoleTitle")}`}
      seoDescription={t("platform.profileSubtitle")}
      headerIcon={User}
      headerTitle={t("platform.profileTitle")}
      headerSubtitle={t("platform.profileSubtitle")}
      className="text-start"
    >
      <div className="space-y-8">
        {loadingProfile ? (
          <CardSkeleton count={2} className="grid-cols-1 lg:grid-cols-3" />
        ) : profileError || !profile ? (
          <ErrorState
            title={t("platform.loadFailed")}
            description={t("platform.loadFailedHint")}
            onRetry={() => void refetch()}
          />
        ) : (
          <div className="space-y-6">
            <SubTabBar tabs={tabs} value={activeTab} onChange={(key) => handleTabChange(key)} />

            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={reducedMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reducedMotion ? undefined : { opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                {activeTab === "profile" && (
                  <motion.div
                    variants={containerVariants}
                    initial={reducedMotion ? false : "hidden"}
                    animate="show"
                    className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start"
                  >
                    <motion.div variants={cardVariants}>
                      <PlatformProfileCard profile={profile} />
                    </motion.div>

                    <motion.div variants={cardVariants} className="lg:col-span-2">
                      <PlatformProfileNameForm
                        initialName={profile.name ?? ""}
                        initialPhone={profile.phone}
                      />
                    </motion.div>
                  </motion.div>
                )}

                {activeTab === "security" && (
                  <motion.div
                    variants={containerVariants}
                    initial={reducedMotion ? false : "hidden"}
                    animate="show"
                    className="max-w-3xl"
                  >
                    <motion.div variants={cardVariants}>
                      <PlatformProfilePasswordForm />
                    </motion.div>
                  </motion.div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        )}
      </div>
    </ModulePageShell>
  );
}
