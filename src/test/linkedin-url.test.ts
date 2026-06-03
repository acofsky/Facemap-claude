import { describe, it, expect } from 'vitest';
import { normalizeLinkedInUrl } from '@/components/LinkedInLinkSection';

describe('normalizeLinkedInUrl', () => {
  it('keeps a full https profile URL', () => {
    expect(normalizeLinkedInUrl('https://www.linkedin.com/in/jane-doe'))
      .toBe('https://www.linkedin.com/in/jane-doe');
  });

  it('prepends https:// to a bare host/path', () => {
    expect(normalizeLinkedInUrl('linkedin.com/in/jane'))
      .toBe('https://linkedin.com/in/jane');
    expect(normalizeLinkedInUrl('www.linkedin.com/in/jane'))
      .toBe('https://www.linkedin.com/in/jane');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeLinkedInUrl('  https://linkedin.com/in/jane  '))
      .toBe('https://linkedin.com/in/jane');
  });

  it('accepts company and regional subdomains', () => {
    expect(normalizeLinkedInUrl('https://linkedin.com/company/acme')).toBeTruthy();
    expect(normalizeLinkedInUrl('https://uk.linkedin.com/in/jane')).toBeTruthy();
  });

  it('rejects non-LinkedIn URLs', () => {
    expect(normalizeLinkedInUrl('https://example.com/in/jane')).toBeNull();
    expect(normalizeLinkedInUrl('https://notlinkedin.com.evil.com/x')).toBeNull();
    expect(normalizeLinkedInUrl('just some text')).toBeNull();
  });

  it('rejects empty input', () => {
    expect(normalizeLinkedInUrl('')).toBeNull();
    expect(normalizeLinkedInUrl('   ')).toBeNull();
  });
});
