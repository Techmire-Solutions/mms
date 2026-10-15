import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";

import { FORM_CHECKBOX } from "@/components/ui/formStyles";
import { cn } from "@/lib/utils";

function Checkbox({
  className,
  id,
  ref,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  const fallbackId = React.useId();
  const resolvedId = id || fallbackId;
  return (
    <CheckboxPrimitive.Root
      id={resolvedId}
      ref={ref}
      className={cn(FORM_CHECKBOX, className)}
      {...props}
    >
      <CheckboxPrimitive.Indicator className={cn("flex items-center justify-center text-current")}>
        <Check className="h-4 w-4" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
