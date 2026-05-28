import { describe, it, expect } from 'vitest';
import {
  normalizeName,
  makeDedupeKey,
  fuzzyNameMatch,
  mergeDrafts,
  findMatchesAgainstPeople,
} from '@/lib/import/dedupe';
import type { CandidateDraft } from '@/lib/import/types';

describe('normalizeName', () => {
  it('strips diacritics and lowercases', () => {
    expect(normalizeName('José García-López')).toBe('jose garcia lopez');
  });
  it('collapses punctuation to spaces', () => {
    expect(normalizeName('  Dr. Mary-Anne  O\'Neill ')).toBe('dr mary anne o neill');
  });
});

describe('makeDedupeKey', () => {
  it('uses phone last 7 digits when present', () => {
    const k = makeDedupeKey({ name: 'Alex Chen', phone: '+1 (415) 555-9821' });
    expect(k).toBe('alex chen | p:5559821');
  });
  it('falls back to email local-part', () => {
    const k = makeDedupeKey({ name: 'Alex Chen', email: 'alex.chen@example.com' });
    expect(k).toBe('alex chen | e:alex.chen');
  });
  it('falls back to name alone', () => {
    expect(makeDedupeKey({ name: 'Alex Chen' })).toBe('alex chen');
  });
  it('treats too-short phones as missing', () => {
    expect(makeDedupeKey({ name: 'Alex', phone: '123' })).toBe('alex');
  });
});

describe('fuzzyNameMatch', () => {
  it('matches one-edit typos', () => {
    expect(fuzzyNameMatch('Stephen Curry', 'Steven Curry')).toBe(true);
  });
  it('rejects short-name collisions', () => {
    expect(fuzzyNameMatch('Bob', 'Rob')).toBe(false);
  });
  it('ignores casing and punctuation', () => {
    expect(fuzzyNameMatch("o'neill", 'ONeill')).toBe(true);
  });
});

describe('mergeDrafts', () => {
  it('collapses cross-source duplicates and merges fields', () => {
    const drafts: CandidateDraft[] = [
      { source: 'contacts', name: 'Alex Chen', phone: '+14155559821' },
      { source: 'linkedin', name: 'Alex Chen', email: 'ac@x.com', company: 'Stripe', title: 'Senior PM' },
    ];
    const merged = mergeDrafts(drafts);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      name: 'Alex Chen',
      phone: '+14155559821',
      email: 'ac@x.com',
      company: 'Stripe',
      title: 'Senior PM',
    });
  });

  it('keeps distinct people separate', () => {
    const drafts: CandidateDraft[] = [
      { source: 'contacts', name: 'Alex Chen', phone: '5559821' },
      { source: 'contacts', name: 'Alex Chen', phone: '4441111' },
    ];
    expect(mergeDrafts(drafts)).toHaveLength(2);
  });

  it('fuzzy-merges name-only orphans', () => {
    const drafts: CandidateDraft[] = [
      { source: 'photo_ocr', name: 'Stephen Curry' },
      { source: 'linkedin', name: 'Steven Curry' },
    ];
    expect(mergeDrafts(drafts)).toHaveLength(1);
  });

  it('drops empty names', () => {
    const drafts: CandidateDraft[] = [
      { source: 'contacts', name: '' },
      { source: 'contacts', name: '   ' },
      { source: 'contacts', name: 'Real Person' },
    ];
    expect(mergeDrafts(drafts)).toHaveLength(1);
  });
});

describe('findMatchesAgainstPeople', () => {
  it('matches by normalized name', () => {
    const drafts: CandidateDraft[] = [{ source: 'linkedin', name: 'José García' }];
    const people = [{ id: 'p1', name: 'Jose Garcia' }];
    const matches = findMatchesAgainstPeople(drafts, people);
    expect(matches.get(0)).toBe('p1');
  });

  it('returns no match when nothing collides', () => {
    const drafts: CandidateDraft[] = [{ source: 'linkedin', name: 'Brand New' }];
    const people = [{ id: 'p1', name: 'Old Friend' }];
    const matches = findMatchesAgainstPeople(drafts, people);
    expect(matches.size).toBe(0);
  });
});
