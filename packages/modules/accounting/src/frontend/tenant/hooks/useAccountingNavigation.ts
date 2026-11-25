import { createContext, use, useCallback, useEffect, useState } from "react";
import type { AccountingSubTabId } from "../accountingPageSubTabs";

export interface AccountingNavigationTarget {
  tab: "work" | "setup";
  subTab?: AccountingSubTabId;
  /** Element id to scroll to once the target tab has rendered. */
  anchorId?: string;
}

export type AccountingNavigate = (target: AccountingNavigationTarget) => void;

/** Provided by the Accounting page so nested panels can jump to another tab section. */
export const AccountingNavigationContext = createContext<AccountingNavigate | null>(null);

/** `null` outside the Accounting page (e.g. a panel rendered on its own in a test). */
export function useAccountingNavigate(): AccountingNavigate | null {
  return use(AccountingNavigationContext);
}

/** Lazy tiers can take a moment to mount; stop looking for the anchor after this. */
const ANCHOR_WAIT_MS = 3000;

function revealAnchor(element: HTMLElement): void {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  element.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  if (!element.hasAttribute("tabindex")) element.setAttribute("tabindex", "-1");
  element.focus({ preventScroll: true });
}

interface AccountingNavigationControllerOptions {
  setActiveTab: (tab: string) => void;
  setActiveSubTab: (subTab: AccountingSubTabId) => void;
}

export function useAccountingNavigationController({
  setActiveTab,
  setActiveSubTab,
}: AccountingNavigationControllerOptions): AccountingNavigate {
  const [pendingAnchor, setPendingAnchor] = useState<{ id: string; at: number } | null>(null);

  useEffect(() => {
    if (!pendingAnchor) return;
    let frame = 0;
    const seek = (): void => {
      const element = document.getElementById(pendingAnchor.id);
      if (element) {
        revealAnchor(element);
        setPendingAnchor(null);
        return;
      }
      if (performance.now() - pendingAnchor.at < ANCHOR_WAIT_MS) {
        frame = requestAnimationFrame(seek);
      } else {
        setPendingAnchor(null);
      }
    };
    frame = requestAnimationFrame(seek);
    return () => cancelAnimationFrame(frame);
  }, [pendingAnchor]);

  return useCallback(
    (target: AccountingNavigationTarget) => {
      setActiveTab(target.tab);
      if (target.subTab) setActiveSubTab(target.subTab);
      if (target.anchorId) setPendingAnchor({ id: target.anchorId, at: performance.now() });
    },
    [setActiveTab, setActiveSubTab],
  );
}
