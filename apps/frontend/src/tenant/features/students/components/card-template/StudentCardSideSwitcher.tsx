import React from 'react';
import type { TranslationFunction } from '@/lib/contexts/TranslationContext';
import { CompactSegmentedControl } from '@/components/ui/CompactSegmentedControl';
import type { CardSide } from '../../lib/studentCardTemplateTypes';

export interface StudentCardSideSwitcherProps {
  activeSide: CardSide;
  onSelectSide: (side: CardSide) => void;
  t: TranslationFunction;
}

export function StudentCardSideSwitcher({
  activeSide,
  onSelectSide,
  t,
}: StudentCardSideSwitcherProps): React.JSX.Element {
  return (
    <CompactSegmentedControl<CardSide>
      value={activeSide}
      onChange={onSelectSide}
      ariaLabel={t('students.cardTemplate.sideGroup')}
      options={[
        { value: 'front', label: t('students.cardTemplate.side.front') },
        { value: 'back', label: t('students.cardTemplate.side.back') },
      ]}
    />
  );
}
