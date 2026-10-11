import type { AppTranslationKey } from '@mms/shared';

/** Gallery section ids — single catalog of shared UI primitives. */
export type DesignSystemSectionId =
  | 'actions'
  | 'inputs'
  | 'feedback'
  | 'overlays'
  | 'data'
  | 'layout';

export interface DesignSystemSectionMeta {
  id: DesignSystemSectionId;
  labelKey: AppTranslationKey;
  /** Sanctioned primitive names shown in this section (enforcement + docs). */
  primitives: readonly string[];
}

/**
 * Registry of Design System gallery sections.
 * Every sanctioned primitive from mms-ui-ux-design §1 should appear once here.
 */
export const DESIGN_SYSTEM_SECTIONS: readonly DesignSystemSectionMeta[] = [
  {
    id: 'actions',
    labelKey: 'platform.designSystemActions',
    primitives: ['Button', 'TableCellLink', 'DensityToggle', 'CopyButton'],
  },
  {
    id: 'inputs',
    labelKey: 'platform.designSystemInputs',
    primitives: [
      'Input',
      'LeadingIconInput',
      'Textarea',
      'Checkbox',
      'Switch',
      'FormSelect',
      'EditableSelect',
      'CompactSegmentedControl',
      'DateRangeFilterBar',
      'RadioGroup',
      'FormCheckboxCard',
    ],
  },
  {
    id: 'feedback',
    labelKey: 'platform.designSystemFeedback',
    primitives: ['EmptyState', 'ErrorState', 'StatusBadge', 'Badge', 'WarningCallout'],
  },
  {
    id: 'overlays',
    labelKey: 'platform.designSystemOverlays',
    primitives: ['Popover', 'Tooltip', 'DropdownMenu', 'Modal', 'FormModal', 'CommandPalette'],
  },
  {
    id: 'data',
    labelKey: 'platform.designSystemData',
    primitives: ['StatCard', 'Table', 'Skeleton', 'ListPagination'],
  },
  {
    id: 'layout',
    labelKey: 'platform.designSystemLayout',
    primitives: ['Card', 'SubTabBar', 'Breadcrumb', 'PageHeader', 'WizardStepIndicator'],
  },
] as const;

/** Flat list of every primitive registered in the gallery (for tests). */
export const DESIGN_SYSTEM_PRIMITIVES: readonly string[] = DESIGN_SYSTEM_SECTIONS.flatMap(
  (section) => section.primitives,
);
