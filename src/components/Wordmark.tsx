import { cn } from "@/lib/utils";

interface WordmarkProps {
  className?: string;
  /** Color of the letterforms. Defaults to foreground (#F4F4F4). */
  tone?: "light" | "dark";
}

/**
 * The membr. wordmark — DM Serif Display, lowercase, with a Primary Red period.
 * Per Visual Brief §11: the period is part of the wordmark. Never omit it.
 */
export function Wordmark({ className, tone = "light" }: WordmarkProps) {
  const letterColor = tone === "light" ? "text-foreground" : "text-black";
  return (
    <span
      className={cn(
        "font-display inline-flex items-baseline leading-none",
        letterColor,
        className,
      )}
      aria-label="membr"
    >
      membr<span className="text-primary">.</span>
    </span>
  );
}
