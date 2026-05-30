import { describe, it, expect } from 'vitest';
import { stripOwnName, bulletDuplicatesStructured } from '@/lib/import/promote';

describe('stripOwnName', () => {
  it('strips a leading self-name with " at " separator', () => {
    expect(stripOwnName('Will Rizzo at Alvarez & Marsal', 'Will Rizzo')).toBe(
      'Alvarez & Marsal',
    );
  });

  it('strips a leading self-name with an em-dash separator', () => {
    expect(stripOwnName('Max Dawson — restructuring advisor', 'Max Dawson')).toBe(
      'Restructuring advisor',
    );
  });

  it('strips a leading self-name with a comma separator', () => {
    expect(stripOwnName('Jane Doe, analyst', 'Jane Doe')).toBe('Analyst');
  });

  it('is case-insensitive on the name match', () => {
    expect(stripOwnName('will rizzo at FTI', 'Will Rizzo')).toBe('FTI');
  });

  it('drops the bullet entirely when only the name (or a bare separator) remains', () => {
    expect(stripOwnName('Will Rizzo', 'Will Rizzo')).toBe('');
    expect(stripOwnName('Will Rizzo —', 'Will Rizzo')).toBe('');
  });

  it('leaves a bullet that mentions SOMEONE ELSE untouched', () => {
    expect(stripOwnName('Knows John Smith', 'Will Rizzo')).toBe('Knows John Smith');
  });

  it('leaves a bullet that does not start with the name untouched', () => {
    expect(stripOwnName('Analyst at Alvarez & Marsal', 'Will Rizzo')).toBe(
      'Analyst at Alvarez & Marsal',
    );
  });

  it('returns the trimmed bullet unchanged when no name is provided', () => {
    expect(stripOwnName('  Analyst at FTI  ', '')).toBe('Analyst at FTI');
    expect(stripOwnName('Analyst at FTI', null)).toBe('Analyst at FTI');
    expect(stripOwnName('Analyst at FTI', undefined)).toBe('Analyst at FTI');
  });
});

describe('bulletDuplicatesStructured', () => {
  it('flags a bullet that equals the company (ignoring case/punctuation)', () => {
    expect(bulletDuplicatesStructured('M3 Consulting', { company: 'M3 Consulting' })).toBe(true);
    expect(bulletDuplicatesStructured('m3 consulting', { company: 'M3 Consulting' })).toBe(true);
    expect(bulletDuplicatesStructured('Alvarez & Marsal', { company: 'Alvarez & Marsal' })).toBe(true);
  });

  it('flags a bullet that equals the title', () => {
    expect(bulletDuplicatesStructured('Managing Director', { title: 'Managing Director' })).toBe(true);
  });

  it('flags a bullet that equals "title at company"', () => {
    expect(
      bulletDuplicatesStructured('Analyst at FTI', { title: 'Analyst', company: 'FTI' }),
    ).toBe(true);
  });

  it('does NOT flag a bullet with extra substance beyond the company', () => {
    expect(
      bulletDuplicatesStructured('Restructuring advisor at M3 Consulting', { company: 'M3 Consulting' }),
    ).toBe(false);
  });

  it('does NOT flag when there is no structured company/title', () => {
    expect(bulletDuplicatesStructured('M3 Consulting', {})).toBe(false);
  });

  it('does NOT flag an unrelated fact', () => {
    expect(bulletDuplicatesStructured('Met at Berlin trip', { company: 'M3 Consulting' })).toBe(false);
  });
});
