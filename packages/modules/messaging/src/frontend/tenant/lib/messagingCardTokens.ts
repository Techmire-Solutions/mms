export const getMessagingChannelAccentBarClass = (isSelected: boolean, channel: string): string => {
  if (isSelected) return "bg-primary/70 group-hover:bg-primary";
  if (channel === "whatsapp") return "bg-success/50 group-hover:bg-success";
  if (channel === "sms") return "bg-info/50 group-hover:bg-info";
  if (channel === "email") return "bg-warning/50 group-hover:bg-warning";
  return "bg-muted-foreground/35 group-hover:bg-muted-foreground/60";
};
