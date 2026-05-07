import { cn } from '@/lib/utils';

interface MarkProps {
  className?: string;
  /** Size token. Renders width/height in px. */
  size?: number;
  /** Override the bracket color. Defaults to currentColor so it inherits text-foreground / text-muted-foreground. */
  bracketColor?: string;
  /** Override the dot color. Defaults to the Membr Red token. */
  dotColor?: string;
  /** Aria label. Set "" to hide from screen readers (decorative). */
  label?: string;
}

/**
 * Membr symbol mark — frameless (white-bracket variant).
 * Use on dark surfaces. For the framed iOS app icon, use public/app-icon.png.
 */
export function Mark({
  className,
  size = 24,
  bracketColor,
  dotColor,
  label = 'Membr',
}: MarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 1024 1024"
      fill="none"
      role={label ? 'img' : 'presentation'}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      className={cn('shrink-0', className)}
    >
      {/* Right bracket — 150° arc on the east side */}
      <path
        d="M 595 203 A 320 320 0 0 1 595 821"
        stroke={bracketColor ?? 'currentColor'}
        strokeWidth={48}
        strokeLinecap="round"
        fill="none"
      />
      {/* Left bracket — 150° arc on the west side */}
      <path
        d="M 429 203 A 320 320 0 0 0 429 821"
        stroke={bracketColor ?? 'currentColor'}
        strokeWidth={48}
        strokeLinecap="round"
        fill="none"
      />
      {/* The signal */}
      <circle cx={512} cy={512} r={42} fill={dotColor ?? 'hsl(0 75% 53%)'} />
    </svg>
  );
}

/**
 * Membr framed icon — black rounded square + frameless mark inside.
 * Use this for any in-app spot that needs the iOS-style icon presentation
 * (e.g. settings about screens). The actual iOS home-screen icon is a PNG
 * at public/app-icon.png and ios/App/App/Assets.xcassets/AppIcon-512@2x.png.
 */
export function FramedIcon({ className, size = 32, label = 'Membr' }: { className?: string; size?: number; label?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 1024 1024"
      role={label ? 'img' : 'presentation'}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      className={cn('shrink-0', className)}
    >
      <rect width={1024} height={1024} rx={224} fill="#000000" />
      <path
        d="M 584 242 A 290 290 0 0 1 584 782"
        stroke="hsl(0 0% 96%)"
        strokeWidth={40}
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M 440 242 A 290 290 0 0 0 440 782"
        stroke="hsl(0 0% 96%)"
        strokeWidth={40}
        strokeLinecap="round"
        fill="none"
      />
      <circle cx={512} cy={512} r={38} fill="hsl(0 75% 53%)" />
    </svg>
  );
}
