import * as React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export type StyledSelectOption<T extends string = string> = {
  value: T;
  label: React.ReactNode;
};

interface StyledSelectProps<T extends string> {
  value: T;
  onValueChange: (value: T) => void;
  options: ReadonlyArray<StyledSelectOption<T>>;
  placeholder?: string;
  className?: string;
  size?: 'sm' | 'md';
  ariaLabel?: string;
  disabled?: boolean;
}

const triggerSizes = {
  sm: 'h-9 px-3 text-xs rounded-lg',
  md: 'h-11 px-3.5 text-sm rounded-xl',
} as const;

export function StyledSelect<T extends string>({
  value,
  onValueChange,
  options,
  placeholder,
  className,
  size = 'md',
  ariaLabel,
  disabled,
}: StyledSelectProps<T>) {
  return (
    <Select value={value} onValueChange={(v) => onValueChange(v as T)} disabled={disabled}>
      <SelectTrigger
        aria-label={ariaLabel}
        className={cn(
          triggerSizes[size],
          'w-full justify-between border border-white/[0.08] bg-white/[0.04] text-white font-medium',
          'hover:bg-white/[0.06] hover:border-white/[0.12]',
          'focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/30',
          'data-[state=open]:border-primary/40 data-[state=open]:bg-white/[0.06]',
          'transition-colors',
          className,
        )}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent
        className={cn(
          'rounded-xl border border-white/[0.08] bg-card/95 backdrop-blur-xl text-white shadow-2xl',
          'p-1',
        )}
      >
        {options.map((opt) => (
          <SelectItem
            key={opt.value}
            value={opt.value}
            className={cn(
              'rounded-lg px-3 py-2 text-sm cursor-pointer',
              'focus:bg-primary/15 focus:text-white',
              'data-[state=checked]:bg-primary/20 data-[state=checked]:text-white',
            )}
          >
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
