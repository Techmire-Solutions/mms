import React from "react";
import { Waypoints } from "lucide-react";
import { m } from "framer-motion";
import { useTranslation } from "@/hooks/useTranslation";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { ModulePageShell } from "@/components/app/ModulePageShell";
import { ErdExplorer } from "@/platform/components/erd/ErdExplorer";
import {
  containerVariantsConsole as containerVariants,
  itemVariants,
} from "@/platform/lib/animations";

export default function PlatformErdPage(): React.JSX.Element {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();

  return (
    <ModulePageShell
      seoTitle={`${t("platform.erdTitle")} | ${t("platform.consoleTitle")}`}
      seoDescription={t("platform.erdSubtitle")}
      headerIcon={Waypoints}
      headerTitle={t("platform.erdTitle")}
      headerSubtitle={t("platform.erdSubtitle")}
    >
      <m.div
        variants={containerVariants}
        initial={reducedMotion ? false : "hidden"}
        animate="show"
        className="space-y-6"
      >
        <m.div variants={itemVariants}>
          <ErdExplorer />
        </m.div>
      </m.div>
    </ModulePageShell>
  );
}
