import * as React from "react";

import { cn } from "@/lib/utils";

// Visual Brief §4.4 — Surface 2 fill, 8px radius. Focus ring is the one red moment on a form screen:
// 1px Primary Red border + 3px rgba(224,48,48,0.15) glow.
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-md bg-surface-2 px-3.5 text-base text-foreground placeholder:text-muted-text",
          "border border-[hsl(0_0%_100%/0.08)] transition-colors",
          "focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/15",
          "disabled:cursor-not-allowed disabled:opacity-60",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
