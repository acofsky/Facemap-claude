import { invokeAI } from '@/lib/invoke-ai';
import type { Person } from '@/lib/store';

export type QuizQuestionType = 'photo_name' | 'fact_to_person' | 'person_to_fact' | 'how_met';

export interface QuizQuestion {
  /** Local id, stable for the life of the quiz (for React keys + scoring). */
  id: string;
  type: QuizQuestionType;
  /** The member this question is about — used to render a photo (photo_name)
   *  and to deep-link to their profile from the results screen. */
  personId: string;
  prompt: string;
  options: string[];
  answer: string;
  explanation?: string;
  /** First photo path for photo_name questions; resolved to a URL by the UI. */
  photoPath?: string | null;
}

interface RawQuestion {
  type: QuizQuestionType;
  person_id: string;
  prompt: string;
  options: string[];
  answer: string;
  explanation?: string;
}

export interface QuizGroup {
  kind: 'circle' | 'event';
  name: string;
}

/** Members need at least this many to build 4-option multiple choice. */
export const MIN_QUIZ_MEMBERS = 3;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

let qid = 0;
const nextId = () => `q${qid++}_${Math.random().toString(36).slice(2, 7)}`;

/**
 * Build a quiz for a circle/event. Primary path is the AI edge function,
 * which writes natural, varied questions from the members' free-text notes.
 * If that fails (not deployed, offline, rate-limited), fall back to a small
 * on-device generator so the feature still does something useful.
 */
export async function generateQuiz(group: QuizGroup, members: Person[]): Promise<QuizQuestion[]> {
  const usable = members.filter((m) => m.name?.trim());
  if (usable.length < MIN_QUIZ_MEMBERS) return [];

  try {
    const payload = {
      group: { name: group.name, kind: group.kind },
      members: usable.map((m) => ({
        id: m.id,
        name: m.name,
        hasPhoto: (m.photos?.length ?? 0) > 0,
        how_we_met: m.how_we_met,
        where_when: m.where_when,
        date_met: m.date_met,
        important_info: m.important_info,
        misc_notes: m.misc_notes,
        known_people_notes: m.known_people_notes,
      })),
    };
    const data = await invokeAI<{ questions: RawQuestion[] }>('generate-quiz', payload);
    const mapped = (data?.questions || [])
      .map((q) => toQuestion(q, usable))
      .filter((q): q is QuizQuestion => q !== null);
    if (mapped.length > 0) return shuffle(mapped);
  } catch (e) {
    console.warn('AI quiz generation failed, using local fallback', e);
  }

  return localQuiz(usable);
}

function toQuestion(q: RawQuestion, members: Person[]): QuizQuestion | null {
  const subject = members.find((m) => m.id === q.person_id);
  if (!subject) return null;
  const options = Array.from(new Set((q.options || []).map((o) => o.trim()).filter(Boolean)));
  const answer = (q.answer || '').trim();
  if (!answer || !options.includes(answer) || options.length < 3) return null;
  return {
    id: nextId(),
    type: q.type,
    personId: q.person_id,
    prompt: q.prompt.trim(),
    options: shuffle(options.slice(0, 4)),
    answer,
    explanation: q.explanation?.trim() || undefined,
    photoPath: q.type === 'photo_name' ? (subject.photos?.[0] ?? null) : null,
  };
}

// ---------------------------------------------------------------------------
// On-device fallback. Deliberately simple: only the question types that can be
// built reliably from single-line fields without language understanding —
// photo→name, where-you-met, and how-you-met. The AI path covers the richer
// "who went to Columbia"-style questions.
// ---------------------------------------------------------------------------

function distractorNames(subject: Person, pool: Person[]): string[] {
  return shuffle(pool.filter((p) => p.id !== subject.id).map((p) => p.name)).slice(0, 3);
}

/**
 * Pull quiz-worthy fact lines out of a person's About/Background. Most of what
 * the user records lives here as bullets, so without this the fallback has
 * almost nothing to ask about. We drop provenance/contact lines and anything
 * that names the person (which would give the answer away).
 */
function factsFor(p: Person): string[] {
  const blob = [p.misc_notes, p.important_info].filter(Boolean).join('\n');
  const firstName = (p.name || '').trim().split(/\s+/)[0]?.toLowerCase() || '';
  return blob
    .split('\n')
    .map((l) => l.replace(/^\s*[•\-*]\s*/, '').trim())
    .filter(Boolean)
    .filter((l) => !/^(imported from|email:|phone:|url:|birthday:|linked(in)?\b)/i.test(l))
    .filter((l) => l.length >= 6 && l.length <= 120)
    .filter((l) => !(firstName && l.toLowerCase().includes(firstName)));
}

function localQuiz(members: Person[]): QuizQuestion[] {
  const out: QuizQuestion[] = [];

  // "Who does this describe?" from About/Background bullets — the richest
  // source for most people. Up to 2 facts each so one chatty profile doesn't
  // dominate the quiz.
  for (const m of members) {
    const facts = shuffle(factsFor(m)).slice(0, 2);
    for (const fact of facts) {
      const names = distractorNames(m, members);
      if (names.length < 3) continue;
      out.push({
        id: nextId(),
        type: 'fact_to_person',
        personId: m.id,
        prompt: `Who does this describe? “${fact}”`,
        options: shuffle([m.name, ...names]),
        answer: m.name,
        explanation: m.name,
      });
    }
  }

  // Photo → name for everyone with a photo.
  for (const m of members) {
    if ((m.photos?.length ?? 0) === 0) continue;
    const names = distractorNames(m, members);
    if (names.length < 3) continue;
    out.push({
      id: nextId(),
      type: 'photo_name',
      personId: m.id,
      prompt: "Who's this?",
      options: shuffle([m.name, ...names]),
      answer: m.name,
      explanation: m.name,
      photoPath: m.photos[0],
    });
  }

  // "Where did you meet X?" from where_when, with other members' real
  // where_when values as distractors.
  const withWhere = members.filter((m) => m.where_when?.trim());
  for (const m of withWhere) {
    const others = shuffle(
      withWhere.filter((p) => p.id !== m.id && p.where_when?.trim() !== m.where_when?.trim())
        .map((p) => p.where_when!.trim()),
    );
    const distinct = Array.from(new Set(others)).slice(0, 3);
    if (distinct.length < 3) continue;
    out.push({
      id: nextId(),
      type: 'person_to_fact',
      personId: m.id,
      prompt: `Where did you meet ${m.name}?`,
      options: shuffle([m.where_when!.trim(), ...distinct]),
      answer: m.where_when!.trim(),
      explanation: `${m.name} — ${m.where_when!.trim()}`,
    });
  }

  // "How do you know X?" from how_we_met.
  const withHow = members.filter((m) => m.how_we_met?.trim());
  for (const m of withHow) {
    const others = shuffle(
      withHow.filter((p) => p.id !== m.id && p.how_we_met?.trim() !== m.how_we_met?.trim())
        .map((p) => p.how_we_met!.trim()),
    );
    const distinct = Array.from(new Set(others)).slice(0, 3);
    if (distinct.length < 3) continue;
    out.push({
      id: nextId(),
      type: 'how_met',
      personId: m.id,
      prompt: `How do you know ${m.name}?`,
      options: shuffle([m.how_we_met!.trim(), ...distinct]),
      answer: m.how_we_met!.trim(),
      explanation: `${m.name} — ${m.how_we_met!.trim()}`,
    });
  }

  // Cap and shuffle so a big circle doesn't produce a 40-question marathon.
  return shuffle(out).slice(0, 12);
}
