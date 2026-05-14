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
  blue: 'Blue',
  purple: 'Purple',
  green: 'Green',
  amber: 'Amber',
  slate: 'Slate',
  rose: 'Rose',
  teal: 'Teal',
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
              // box-shadow follows the circular border-radius perfectly,
              // whereas Tailwind's ring utility gets clipped on round buttons
              // inside a horizontally-scrolling container.
              style={active ? { boxShadow: '0 0 0 2px hsl(var(--foreground))' } : undefined}
            >
              {active && <Check className="w-5 h-5 text-white" strokeWidth={2} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
