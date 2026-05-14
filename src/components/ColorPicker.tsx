import { Check } from 'lucide-react';
import { TONES, type Tone } from '@/lib/store';
import { cn } from '@/lib/utils';

interface ColorPickerProps {
  value: Tone;
  onChange: (tone: Tone) => void;
  className?: string;
}

const LABELS: Record<Tone, string> = {
  red: 'Red',
  orange: 'Orange',
  amber: 'Amber',
  green: 'Green',
  mint: 'Mint',
  teal: 'Teal',
  blue: 'Blue',
  indigo: 'Indigo',
  purple: 'Purple',
  fuchsia: 'Fuchsia',
  rose: 'Rose',
  slate: 'Slate',
};

/**
 * 48pt gradient swatches in a horizontal scroll strip.
 * Selected = white checkmark + 2pt #F4F4F4 ring. Per Visual Brief §11.
 * Red is always first.
 */
export function ColorPicker({ value, onChange, className }: ColorPickerProps) {
  return (
    // overflow-x-auto would clip the selection ring vertically on iOS,
    // so we use overflow-x-scroll + overflow-y-visible explicitly + vertical
    // padding to give the box-shadow room to bleed out.
    <div className={cn('overflow-x-scroll overflow-y-visible scrollbar-hide -mx-5 px-5 py-1', className)}>
      <div className="flex gap-3">
        {TONES.map((tone) => {
          const active = tone === value;
          return (
            <button
              key={tone}
              type="button"
              onClick={() => onChange(tone)}
              aria-label={`Choose ${LABELS[tone]}`}
              aria-pressed={active}
              className={cn(
                'shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-transform active:scale-95',
                `tile-${tone}`,
              )}
              // Selected ring uses box-shadow (Tailwind's ring clips on round
              // buttons in horizontal scrollers). Inactive swatches get a
              // hairline inset outline so the most muted tones (slate, deep
              // purple) stay visibly distinct from the #000 background and
              // never read as "gaps" between siblings.
              style={
                active
                  ? { boxShadow: '0 0 0 2px hsl(var(--foreground))' }
                  : { boxShadow: 'inset 0 0 0 1px hsl(0 0% 100% / 0.18)' }
              }
            >
              {active && <Check className="w-5 h-5 text-white" strokeWidth={2} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
