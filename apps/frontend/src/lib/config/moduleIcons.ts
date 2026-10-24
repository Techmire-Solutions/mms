import {
  BookOpen,
  Boxes,
  Calendar,
  CheckSquare,
  ClipboardList,
  DollarSign,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Library,
  type LucideIcon,
  MessageSquare,
  Network,
  Presentation,
  Scale,
  School,
  Star,
  TrendingUp,
  UserCheck,
  UserCog,
  Users,
} from "lucide-react";

/** Lucide icons referenced by {@link SYSTEM_MODULES} `icon` string keys. */
export const MODULE_ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  GraduationCap,
  Users,
  MessageSquare,
  Calendar,
  UserCheck,
  FileText,
  DollarSign,
  Star,
  UserCog,
  ClipboardList,
  TrendingUp,
  BookOpen,
  Boxes,
  School,
  Library,
  Scale,
  CheckSquare,
  Network,
  Presentation,
};

export function resolveModuleIcon(iconName: string, fallback: LucideIcon = Boxes): LucideIcon {
  return MODULE_ICONS[iconName] ?? fallback;
}
