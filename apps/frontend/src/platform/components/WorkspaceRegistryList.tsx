import React from "react";
import { ArrowRight, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { AppTranslationKey, PublicWorkspaceSummary } from "@mms/shared";
import { ROUTES } from "@/lib/config/routes";
import { getAppDomain, tenantUrl } from "@/lib/config/tenantConfig";
import { useTranslation } from "@/hooks/useTranslation";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useWorkspaceRegistry } from "@/platform/hooks/useWorkspaceRegistry";
import WorkspaceLogo from "@/platform/components/WorkspaceLogo";
import { CardSkeleton } from "@/components/app/LoadingState";
import { ErrorState } from "@/components/app/ErrorState";
import { EmptyState } from "@/components/app/EmptyState";
import { SectionLabel } from "@/components/app/SectionLabel";
import { containerVariants, cardVariants } from "@/platform/lib/animations";
import { CARD_STRIPE_BASE, CARD_STRIPE_INSET } from "@/lib/ui/semanticTone";
import { cn } from "@/lib/utils";

type WorkspaceLinkDestination = typeof ROUTES.login | typeof ROUTES.forgotPassword;

interface WorkspaceRegistryListProps {
  headingKey?: AppTranslationKey;
  emptyMessageKey?: AppTranslationKey;
  destinationPath?: WorkspaceLinkDestination;
  actionLabelKey?: AppTranslationKey;
}

/**
 * Fetches and renders all registered madrasa workspaces as prominent sign-in links.
 */
export default function WorkspaceRegistryList({
  headingKey = "apex.registeredMadrasas",
  emptyMessageKey = "apex.noMadrasasYet",
  destinationPath = ROUTES.login,
  actionLabelKey = "auth.signInTo",
}: WorkspaceRegistryListProps): React.JSX.Element {
  const { t } = useTranslation();
  const appDomain = getAppDomain();
  const reducedMotion = useReducedMotion();
  const { data: workspaces, isLoading, isError, refetch } = useWorkspaceRegistry();

  if (isLoading) {
    return <CardSkeleton count={2} className="grid-cols-1 sm:grid-cols-2" />;
  }

  if (isError) {
    return (
      <ErrorState
        title={t("apex.loadError")}
        description={t("apex.loadFailedHint")}
        onRetry={() => void refetch()}
      />
    );
  }

  const items = workspaces ?? [];

  if (items.length === 0) {
    return <EmptyState title={t(emptyMessageKey)} compact />;
  }

  return (
    <div className="w-full space-y-3">
      <SectionLabel as="p" weight="semibold" className="text-center">
        {t(headingKey)}
      </SectionLabel>
      <motion.ul
        variants={reducedMotion ? undefined : containerVariants}
        initial={reducedMotion ? false : "hidden"}
        animate={reducedMotion ? undefined : "show"}
        className="space-y-3"
      >
        <AnimatePresence>
          {items.map((workspace) => (
            <RegistryWorkspaceRow
              key={workspace.subdomain}
              workspace={workspace}
              appDomain={appDomain}
              destinationPath={destinationPath}
              actionLabelKey={actionLabelKey}
              reducedMotion={reducedMotion}
            />
          ))}
        </AnimatePresence>
      </motion.ul>
      <p className="flex items-center justify-center gap-1.5 pt-1 text-center text-xs font-medium text-muted-foreground">
        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        {t("apex.opensSignInHint")}
      </p>
    </div>
  );
}

const RegistryWorkspaceRow = function RegistryWorkspaceRow({
  workspace,
  appDomain,
  destinationPath,
  actionLabelKey,
  reducedMotion,
}: {
  workspace: PublicWorkspaceSummary;
  appDomain: string;
  destinationPath: WorkspaceLinkDestination;
  actionLabelKey: AppTranslationKey;
  reducedMotion: boolean;
}): React.JSX.Element {
  const { t } = useTranslation();
  const targetUrl = tenantUrl(workspace.subdomain, destinationPath);
  const actionLabel = t(actionLabelKey, { name: workspace.madrasaName });

  return (
    <motion.li variants={reducedMotion ? undefined : cardVariants} layout={!reducedMotion}>
      <a
        href={targetUrl}
        className={cn(
          "relative overflow-hidden group/card block w-full cursor-pointer rounded-2xl border border-border/50 bg-card/70 p-4 text-start shadow-sm backdrop-blur-sm transition-all duration-300 hover:border-primary/30 hover:bg-card hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
          CARD_STRIPE_INSET,
        )}
        aria-label={actionLabel}
      >
        <div
          aria-hidden="true"
          className={cn(
            CARD_STRIPE_BASE,
            "bg-primary/50 group-hover/card:bg-primary transition-colors duration-150 ease-out",
          )}
        />
        <div className="flex items-center gap-3.5">
          <div className="relative transition-transform duration-300 group-hover:scale-105">
            <WorkspaceLogo
              logoUrl={workspace.logoUrl}
              madrasaName={workspace.madrasaName}
              className="rounded-xl border border-border/30"
            />
          </div>
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="text-sm font-bold text-foreground transition-colors group-hover:text-primary">
              {workspace.madrasaName}
            </p>
            <p className="break-all font-mono text-xs text-muted-foreground">
              {workspace.subdomain}.{appDomain}
            </p>
            {workspace.tagline ? (
              <p className="truncate text-xs font-medium text-muted-foreground">
                {workspace.tagline}
              </p>
            ) : null}
          </div>
        </div>
        <div className="mt-3.5 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-primary text-xs font-bold text-primary-foreground shadow-sm shadow-primary/10 transition-colors group-hover:bg-primary/95">
          {actionLabel}
          <ArrowRight
            className="h-3.5 w-3.5 transition-transform duration-250 group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
            aria-hidden
          />
        </div>
      </a>
    </motion.li>
  );
};
