import React, { useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FORM_LABEL } from '@/components/ui/formStyles';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';

export interface PasswordInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  id: string;
  label?: string;
  showToggle?: boolean;
  minPasswordLength?: number;
}

export const PasswordInput: React.FC<PasswordInputProps> = ({
  id,
  label,
  showToggle = true,
  minPasswordLength,
  value,
  onChange,
  disabled,
  autoComplete = 'current-password',
  required = true,
  className,
  ...rest
}) => {
  const { t } = useTranslation();
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="space-y-1.5 text-start">
      {label ? (
        <label htmlFor={id} className={FORM_LABEL}>
          {label}
        </label>
      ) : null}
      <div className="relative">
        <Lock
          className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/80"
          aria-hidden
        />
        <Input
          id={id}
          type={showToggle && showPassword ? 'text' : 'password'}
          autoComplete={autoComplete}
          required={required}
          minLength={minPasswordLength}
          value={value}
          onChange={onChange}
          disabled={disabled}
          className={cn('h-11 ps-9', showToggle && 'pe-11', className)}
          {...rest}
        />
        {showToggle ? (
          <Button
            variant="ghost"
            size="icon"
            type="button"
            disabled={disabled}
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute end-0.5 top-1/2 flex min-h-11 min-w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50"
            aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
            aria-pressed={showPassword}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" aria-hidden />
            ) : (
              <Eye className="h-4 w-4" aria-hidden />
            )}
          </Button>
        ) : null}
      </div>
    </div>
  );
};
