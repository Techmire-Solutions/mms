import React, { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";
import { useScrollSurfaceOnChange } from "@/lib/routing/useScrollSurfaceOnChange";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { TabTrigger } from "@/components/app/ResponsiveAccordionTabTrigger";
import { ResponsiveAccordionTabsDesktop } from "@/components/app/ResponsiveAccordionTabsDesktop";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useSafeViewTransition } from "@/hooks/useSafeViewTransition";
import { MEDIA_LG_UP } from "@/lib/breakpoints";
import type { ResponsiveAccordionTabsProps } from "@/components/app/ResponsiveAccordionTabsTypes";

export type {
  AccordionTabItem,
  ResponsiveAccordionTabsProps,
} from "@/components/app/ResponsiveAccordionTabsTypes";

/**
 * Responsive tab shell — mobile accordion (content under active heading),
 * desktop horizontal tabs or sidebar nav.
 */
export const ResponsiveAccordionTabs = function ResponsiveAccordionTabs({
  tabs,
  activeTab,
  onTabChange,
  children,
  isDirty = false,
  onSave,
  desktopLayout = "horizontal",
  hideWhenSingle = false,
  collapsible = true,
  panelIdPrefix = "tab-panel",
  className,
}: ResponsiveAccordionTabsProps): React.JSX.Element {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const safeViewTransition = useSafeViewTransition();
  const sectionRefs = useRef<Partial<Record<string, HTMLElement | null>>>({});
  const [scrollOnChangeEnabled, setScrollOnChangeEnabled] = useState(false);
  const prefix = panelIdPrefix;
  // Declared before the handler: collapse-on-active-click is an accordion
  // affordance. On desktop the tier strip is a tablist, so re-clicking the
  // selected tab must be a no-op — it used to blank the whole module body and
  // persist the collapsed `""` key.
  const isDesktop = useMediaQuery(MEDIA_LG_UP);

  const handleTabChange = async (tabId: string) => {
    // Only a user-initiated tab change may scroll the page. Persisted/deep-linked
    // tabs resolve after mount and used to move the viewport past the page header.
    setScrollOnChangeEnabled(true);
    if (!isDesktop && collapsible && activeTab === tabId) {
      safeViewTransition(() => onTabChange(""));
      return;
    }
    if (tabId === activeTab) return;
    if (isDirty && onSave) {
      try {
        const res = await onSave();
        if (res === false) return;
      } catch {
        return;
      }
    }
    safeViewTransition(() => onTabChange(tabId));
  };

  useScrollSurfaceOnChange(activeTab, {
    enabled: scrollOnChangeEnabled,
    resolveMobileTarget: (key) => sectionRefs.current[key],
  });

  const panelContent = collapsible && !activeTab ? null : children;

  if (hideWhenSingle && tabs.length <= 1) {
    return <div className={className}>{children}</div>;
  }

  if (tabs.length === 0) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div className={cn("space-y-4", className)}>
      {!isDesktop ? (
        <div className="space-y-3">
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            const panelId = `${prefix}-${tab.id}`;

            return (
              <section
                key={tab.id}
                ref={(node) => {
                  sectionRefs.current[tab.id] = node;
                }}
                className={cn(
                  "overflow-hidden rounded-xl border transition-colors",
                  active
                    ? "border-primary/30 bg-card shadow-md ring-1 ring-primary/10"
                    : "border-border/70 bg-card/60 hover:border-border hover:bg-card/80",
                )}
              >
                <TabTrigger
                  tab={tab}
                  active={active}
                  panelId={panelId}
                  onTabChange={handleTabChange}
                />

                <AnimatePresence initial={false}>
                  {active ? (
                    <motion.div
                      id={panelId}
                      key={tab.id}
                      initial={reducedMotion ? false : { height: 0, opacity: 0 }}
                      animate={reducedMotion ? { opacity: 1 } : { height: "auto", opacity: 1 }}
                      exit={reducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                      transition={
                        reducedMotion ? { duration: 0 } : { duration: 0.22, ease: "easeInOut" }
                      }
                      className="overflow-hidden"
                    >
                      <div className="space-y-4 border-t border-border/70 px-3 py-4 sm:px-4">
                        {children}
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </section>
            );
          })}
        </div>
      ) : (
        <ResponsiveAccordionTabsDesktop
          tabs={tabs}
          activeTab={activeTab}
          desktopLayout={desktopLayout}
          panelContent={panelContent}
          onTabChange={handleTabChange}
          sectionAriaLabel={t("nav.sectionAria")}
        />
      )}
    </div>
  );
};
