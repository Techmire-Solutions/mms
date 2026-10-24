import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ShieldAlert, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from "@shared/ui";
import { ROUTES } from "@/lib/config/routes";

export interface PlatformSidebarBrandProps {
  isMobile?: boolean;
  collapsed: boolean;
  reducedMotion: boolean;
  onCloseMobile?: () => void;
}

export function PlatformSidebarBrand({
  isMobile = false,
  collapsed,
  reducedMotion,
  onCloseMobile,
}: PlatformSidebarBrandProps): React.JSX.Element {
  const { t } = useTranslation();
  const [logoError, setLogoError] = useState(false);

  return (
    <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border shrink-0">
      <Link
        to={ROUTES.home}
        onClick={() => isMobile && onCloseMobile?.()}
        className="flex min-h-11 items-center gap-3 overflow-hidden hover:opacity-90 transition-opacity"
      >
        <div className="w-9 h-9 rounded-xl bg-card border border-sidebar-primary/40 flex items-center justify-center shrink-0 shadow-xs p-1 overflow-hidden">
          {!logoError ? (
            <img
              src="/platform-logo.webp"
              alt="Platform Logo"
              width={36}
              height={36}
              loading="eager"
              decoding="async"
              fetchPriority="high"
              className="h-full w-full object-contain"
              onError={() => setLogoError(true)}
            />
          ) : (
            <ShieldAlert className="w-5 h-5 text-sidebar-primary" />
          )}
        </div>
        <AnimatePresence>
          {(isMobile || !collapsed) && (
            <motion.div
              initial={reducedMotion ? false : { opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={reducedMotion ? undefined : { opacity: 0, width: 0 }}
              className="overflow-hidden whitespace-nowrap flex flex-col text-start"
            >
              <span className="text-sidebar-foreground font-semibold text-sm tracking-wide leading-tight">
                {t("entry.productName")}
              </span>
              <span className="text-2xs font-mono text-sidebar-muted-foreground uppercase tracking-wider leading-tight mt-0.5">
                {t("platform.consoleTitle")}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </Link>

      {isMobile && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          icon={X}
          onClick={onCloseMobile}
          className="min-w-11 text-sidebar-muted-foreground hover:text-sidebar-foreground shrink-0 rounded-lg"
          aria-label={t("nav.closeSidebar")}
        />
      )}
    </div>
  );
}
