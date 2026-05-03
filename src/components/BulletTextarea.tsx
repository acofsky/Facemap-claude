import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface BulletTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  autoFocus?: boolean;
}

const BULLET = '• ';

/**
 * Normalizes value so every non-empty line starts with "• ".
 * Empty input returns "• " so the user starts on a bullet.
 */
function normalize(value: string): string {
  if (!value) return BULLET;
  const lines = value.split('\n').map(line => {
    const trimmed = line.replace(/^[ \s•\-\*]+/, '');
    return BULLET + trimmed;
  });
  return lines.join('\n');
}

export function BulletTextarea({
  value,
  onChange,
  placeholder,
  rows = 3,
  className,
  autoFocus,
}: BulletTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const displayValue = value ? normalize(value) : BULLET;

  // Ensure caret starts after the bullet on focus when empty
  useEffect(() => {
    if (autoFocus && ref.current) {
      const el = ref.current;
      el.focus();
      const len = el.value.length;
      el.setSelectionRange(len, len);
    }
  }, [autoFocus]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(normalize(e.target.value));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    if (e.key === 'Enter') {
      e.preventDefault();
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const before = el.value.slice(0, start);
      const after = el.value.slice(end);
      const next = before + '\n' + BULLET + after;
      onChange(next);
      requestAnimationFrame(() => {
        const pos = (before + '\n' + BULLET).length;
        el.setSelectionRange(pos, pos);
      });
    } else if (e.key === 'Backspace') {
      const start = el.selectionStart;
      const end = el.selectionEnd;
      if (start === end) {
        // If caret is right after a bullet "• " at line start, remove the whole line break + bullet
        const before = el.value.slice(0, start);
        const lineStart = before.lastIndexOf('\n') + 1;
        const lineSoFar = before.slice(lineStart);
        if (lineSoFar === BULLET) {
          e.preventDefault();
          if (lineStart === 0) {
            // First line — keep bullet, do nothing
            return;
          }
          const next = el.value.slice(0, lineStart - 1) + el.value.slice(start);
          onChange(next);
          requestAnimationFrame(() => {
            const pos = lineStart - 1;
            el.setSelectionRange(pos, pos);
          });
        }
      }
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    if (!value) {
      onChange(BULLET);
      requestAnimationFrame(() => {
        const el = ref.current;
        if (el) {
          const len = el.value.length;
          el.setSelectionRange(len, len);
        }
      });
    }
  };

  return (
    <textarea
      ref={ref}
      value={displayValue}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onFocus={handleFocus}
      placeholder={placeholder}
      rows={rows}
      className={cn(
        'w-full bg-muted/50 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none',
        className,
      )}
    />
  );
}

interface BulletDisplayProps {
  value: string;
  className?: string;
}

export function BulletDisplay({ value, className }: BulletDisplayProps) {
  const items = value
    .split('\n')
    .map(l => l.replace(/^[ \s•\-\*]+/, '').trim())
    .filter(Boolean);

  if (items.length === 0) return null;

  return (
    <ul className={cn('space-y-1 text-foreground text-sm', className)}>
      {items.map((item, i) => (
        <li key={i} className="flex gap-2">
          <span className="text-primary leading-5">•</span>
          <span className="flex-1 leading-5">{item}</span>
        </li>
      ))}
    </ul>
  );
}
