import React from 'react';
import {
  CompactSegmentedControl,
  type CompactSegmentedOption,
} from '@/components/ui/CompactSegmentedControl';

export type SegmentedPillOption<T extends string> = CompactSegmentedOption<T>;

export interface SegmentedPillFilterProps<T extends string> {
  options: readonly SegmentedPillOption<T>[];
  value: T;
  onChange: (val: T) => void;
  className?: string;
  size?: 'sm' | 'md';
}

/**
 * @deprecated Prefer using `CompactSegmentedControl` from `@/components/ui/CompactSegmentedControl`.
 * Retained as a backward-compatible adapter composing the canonical CompactSegmentedControl primitive.
 */
export function SegmentedPillFilter<T extends string>({
  options,
  value,
  onChange,
  className,
}: SegmentedPillFilterProps<T>): React.JSX.Element {
  return (
    <CompactSegmentedControl
      options={options}
      value={value}
      onChange={onChange}
      className={className}
    />
  );
}
