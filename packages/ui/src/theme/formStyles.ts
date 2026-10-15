import { cn } from "../utils";

/** Shared validation error line below form fields. */
export const FORM_ERROR = "text-xs text-destructive mt-1";

/** Boxed field error (sync forms, dense panels). */
export const FORM_ERROR_BOX =
  "mt-0 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2";

/** Shared input error border and focus ring classes. */
export const FORM_INPUT_ERROR =
  "border-destructive focus-visible:ring-destructive focus-visible:border-destructive";

/** Shared label class for modal / registry-driven forms. */
export const FORM_LABEL =
  "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-foreground";

/** Shared text input — full width, 44px min height, primary focus ring. */
export const FORM_INPUT =
  "w-full rounded-lg border border-border bg-background px-3 py-2.5 min-h-11 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary/40 disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation";

export const FORM_SELECT = `${FORM_INPUT} cursor-pointer`;

export const FORM_TEXTAREA = `${FORM_INPUT} min-h-20 resize-none py-2`;

/** Input with a left icon (e.g. user modals). */
export const FORM_INPUT_ICON = `${FORM_INPUT} ps-9 pe-3`;

/** Compact input for dense tables (e.g. journal lines). */
export const FORM_INPUT_COMPACT = cn(FORM_INPUT, "px-2 py-2 text-xs");

/** Compact builder panels (widget builder, analytics config). */
export const FORM_INPUT_BUILDER = `${FORM_INPUT_COMPACT} bg-card font-semibold`;

/** OTP digit cell (2FA, platform verify). */
export const FORM_OTP_DIGIT =
  "w-11 min-h-11 h-12 text-center text-xl font-bold rounded-xl border-2 bg-card text-foreground focus:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 touch-manipulation";

/** Unified checkbox style — borders, focus rings, primary accent, cursor pointer. */
export const FORM_CHECKBOX =
  "peer relative h-4 w-4 shrink-0 cursor-pointer rounded-sm border border-primary shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground after:absolute after:start-1/2 after:top-1/2 after:h-11 after:w-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-['']";

export const CARD_SURFACE =
  "relative overflow-hidden group/card rounded-2xl border border-foreground/10 bg-card text-card-foreground shadow-xs transition-colors duration-150 ease-out motion-reduce:transition-none";

/** Unified form card container style — matching the centralized Card component. */
export const FORM_CARD = `${CARD_SURFACE} group`;

/** Work directory / settings panel (toolbar, list shell, settings sections). */
export const WORK_SURFACE = "rounded-2xl border border-foreground/10 bg-card shadow-xs";

/** Inner detail surfaces (attribute rows, notes panels). */
export const WORK_SURFACE_INNER = "rounded-xl border border-foreground/8 bg-muted/30";

/** Standardized overlay backdrop for all modals, dialogs, and drawers. */
export const OVERLAY_BACKDROP = "bg-background/80 backdrop-blur-xs";

/** Sticky Work directory table header cells (checkbox / frozen name cols). */
export const WORK_STICKY_HEAD = "bg-card/95 border-b border-border/80";

/** Work toolbar filter / trash / clear trigger base. */
export const WORK_TOOLBAR_TRIGGER =
  "flex items-center gap-1.5 px-3 min-h-11 rounded-xl border text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none touch-manipulation";

/** Active state for Work toolbar triggers (filters with count, trash on). */
export const WORK_TOOLBAR_TRIGGER_ACTIVE =
  "border-primary/40 bg-primary/10 text-primary hover:text-primary hover:bg-primary/10";

/** Idle state for Work toolbar triggers. */
export const WORK_TOOLBAR_TRIGGER_IDLE =
  "border-border bg-card text-muted-foreground hover:text-foreground";

/** Filter-menu active (slightly softer than trash active). */
export const WORK_TOOLBAR_TRIGGER_FILTER_ACTIVE =
  "border-primary/30 bg-primary/5 text-primary hover:text-primary hover:bg-primary/5";

/** Filter-menu idle (foreground text, not muted). */
export const WORK_TOOLBAR_TRIGGER_FILTER_IDLE = "border-border bg-card text-foreground";

/** Detail drawer / profile section headings. */
export const DETAIL_SECTION_TITLE =
  "text-xs font-black text-muted-foreground uppercase tracking-widest";

/** Ultra-compact select trigger style (primarily for dashboard widget chart filters) */
export const FORM_SELECT_MINI =
  "min-h-11 h-11 px-3 py-2 rounded text-xs font-bold bg-card border border-border text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer w-auto gap-1 shadow-none touch-manipulation";

/** Shared SectionCard className for module Setup settings panels. */
export const SETUP_SECTION_CARD_CLASS = "shadow-xs border-foreground/10" as const;
