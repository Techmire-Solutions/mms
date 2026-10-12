/** Shared Call / WhatsApp / SMS / Email action tone classes (detail grids + dense card icons). */

export const MESSAGING_QUICK_ACTION_BASE =
  "rounded-xl border text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 touch-manipulation cursor-pointer";

export const MESSAGING_QUICK_ACTION_TONES = {
  call: "bg-info/10 text-info border-info/20 hover:bg-info/15 hover:border-info/30",
  whatsapp: "bg-success/10 text-success border-success/30 hover:bg-success/15",
  sms: "bg-primary/10 text-primary border-primary/20 hover:bg-primary/15",
  email: "bg-secondary/10 text-secondary border-secondary/20 hover:bg-secondary/15",
  copy: "bg-muted text-muted-foreground border-border/40 hover:bg-muted/80 hover:border-border/60",
  location:
    "bg-warning/10 text-warning border-warning/20 hover:bg-warning/15 hover:border-warning/30",
  link: "bg-primary/10 text-primary border-primary/20 hover:bg-primary/15 hover:border-primary/30",
} as const;

/** Dense icon-only messaging / contact action buttons (directory cards, table cells, drawers). */
export const MESSAGING_ICON_BTN =
  "min-h-11 min-w-11 rounded-xl border shadow-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 touch-manipulation cursor-pointer";

export const MESSAGING_ICON_BTN_TONES = {
  call: "border-info/30 bg-info/5 text-info hover:text-info hover:bg-info/15 hover:border-info/40",
  whatsapp:
    "border-success/30 bg-success/5 text-success hover:text-success hover:bg-success/15 hover:border-success/40",
  sms: "border-primary/30 bg-primary/5 text-primary hover:text-primary hover:bg-primary/15 hover:border-primary/40",
  email:
    "border-secondary/30 bg-secondary/5 text-secondary hover:text-secondary hover:bg-secondary/15 hover:border-secondary/40",
  copy: "border-muted-foreground/30 bg-muted-foreground/5 text-muted-foreground hover:text-foreground hover:bg-muted-foreground/15 hover:border-muted-foreground/40",
  location:
    "border-warning/30 bg-warning/5 text-warning hover:text-warning hover:bg-warning/15 hover:border-warning/40",
  link: "border-primary/30 bg-primary/5 text-primary hover:text-primary hover:bg-primary/15 hover:border-primary/40",
} as const;
