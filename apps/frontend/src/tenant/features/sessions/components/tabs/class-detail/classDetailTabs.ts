import { Award, Calendar, Coffee, GraduationCap, Users, Wallet } from 'lucide-react';
import type { ClassDetailTabItem } from './types';

/** Class detail FormModal tabs (Sections label comes from tenant terminology). */
export const CLASS_DETAIL_TABS: readonly ClassDetailTabItem[] = [
  { id: 'general', labelKey: 'sessions.classes.detail.tab.general', icon: GraduationCap },
  { id: 'sections', labelKey: 'academicTerms.section.plural', icon: Users },
  { id: 'fees', labelKey: 'sessions.classes.detail.tab.fees', icon: Wallet },
  { id: 'schedule', labelKey: 'sessions.classes.detail.tab.schedule', icon: Calendar },
  { id: 'budget', labelKey: 'sessions.classes.detail.tab.budget', icon: Coffee },
  { id: 'scholarship', labelKey: 'sessions.classes.detail.tab.scholarship', icon: Award },
];
