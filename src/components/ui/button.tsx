import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Visual Brief §4 — primary buttons are flat #E03030 with 8px radius and DM Sans 600.
// Secondary buttons are transparent with a hairline border. Never pill-shaped.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-sans font-semibold ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:     "bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-disabled disabled:text-muted-text",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:     "bg-transparent text-foreground border border-[hsl(0_0%_100%/0.2)] hover:border-[hsl(0_0%_100%/0.35)]",
        secondary:   "bg-surface-2 text-foreground border border-[hsl(0_0%_100%/0.12)] hover:border-[hsl(0_0%_100%/0.18)]",
        ghost:       "text-foreground hover:bg-surface-2",
        link:        "text-foreground underline-offset-4 hover:underline",
      },
      size: {
        default: "h-[52px] px-5 text-[15px]",
        sm:      "h-9 px-3 text-sm",
        lg:      "h-[52px] px-8 text-[15px]",
        icon:    "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
