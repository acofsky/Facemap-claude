import type { ImportSource } from '@/lib/import/types';

export function sourceLabel(source: string): string {
  switch (source as ImportSource) {
    case 'contacts': return 'Contacts';
    case 'linkedin': return 'LinkedIn';
    case 'calendar': return 'Calendar';
    case 'photo_ocr': return 'a photo';
    default: return source;
  }
}
