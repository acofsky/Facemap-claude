export type CircleColorKey = 'red' | 'blue' | 'purple' | 'green' | 'amber';

export const CIRCLE_COLOR_KEYS: CircleColorKey[] = ['red', 'blue', 'purple', 'green', 'amber'];

export const CIRCLE_COLOR_LABELS: Record<CircleColorKey, string> = {
  red: 'Red',
  blue: 'Blue',
  purple: 'Purple',
  green: 'Green',
  amber: 'Amber',
};

const HUE_TO_KEY: Array<{ min: number; max: number; key: CircleColorKey }> = [
  { min: 340, max: 360, key: 'red' },
  { min: 0, max: 20, key: 'red' },
  { min: 20, max: 50, key: 'amber' },
  { min: 50, max: 95, key: 'amber' },
  { min: 95, max: 180, key: 'green' },
  { min: 180, max: 255, key: 'blue' },
  { min: 255, max: 340, key: 'purple' },
];

export function resolveCircleColor(raw: string | null | undefined, fallbackSeed?: string): CircleColorKey {
  const v = (raw ?? '').trim().toLowerCase();
  if ((CIRCLE_COLOR_KEYS as string[]).includes(v)) return v as CircleColorKey;

  const hslMatch = v.match(/hsl\(\s*(\d+)/);
  if (hslMatch) {
    const hue = ((parseInt(hslMatch[1], 10) % 360) + 360) % 360;
    for (const range of HUE_TO_KEY) {
      if (hue >= range.min && hue < range.max) return range.key;
    }
  }

  const seed = fallbackSeed ?? raw ?? '';
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return CIRCLE_COLOR_KEYS[Math.abs(hash) % CIRCLE_COLOR_KEYS.length];
}

export function circleTileGradient(key: CircleColorKey): string {
  return `var(--gradient-tile-${key})`;
}

export function circleTileClass(key: CircleColorKey): string {
  return `icon-tile-${key}`;
}

export function circleDotStyle(key: CircleColorKey): React.CSSProperties {
  return { background: `var(--gradient-tile-${key})` };
}
