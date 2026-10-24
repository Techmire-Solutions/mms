import React from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useBranding } from "@/tenant/hooks/useBranding";
import { getInitials } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { ROUTES } from "@/lib/config/routes";
import { WorkspaceLogo } from "@shared/ui";

interface SidebarBrandProps {
  collapsed: boolean;
}

export function SidebarBrand({ collapsed }: SidebarBrandProps): React.JSX.Element {
  const branding = useBranding();
  const { t } = useTranslation();

  return (
    <div className="h-16 flex items-center px-5 border-b border-sidebar-border">
      <Link
        to={ROUTES.home}
        className="flex min-h-11 min-w-11 items-center gap-3 overflow-hidden hover:opacity-90 transition-opacity"
      >
        <WorkspaceLogo
          logoUrl={branding.logoUrl}
          madrasaName={branding.madrasaName || t("entry.productName")}
          size="sm"
          fallbackText={branding.madrasaName ? getInitials(branding.madrasaName, 1) : "م"}
          className="border-sidebar-border"
        />
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              className="overflow-hidden whitespace-nowrap"
            >
              <span className="text-sidebar-foreground font-semibold text-sm tracking-wide">
                {branding.madrasaName || t("entry.productName")}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </Link>
    </div>
  );
}
