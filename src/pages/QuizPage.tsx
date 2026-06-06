import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Brain, Check, X, Loader2, RotateCcw, ChevronRight, Trophy } from 'lucide-react';
import {
  useCircles, useEvents, usePersons, usePersonCircles, usePersonEvents,
} from '@/hooks/use-data';
import { PersonAvatar } from '@/components/PersonAvatar';
import { PhotoImg } from '@/components/PhotoImg';
import { useSwipeBack } from '@/hooks/use-swipe-back';
import { haptics } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import { generateQuiz, MIN_QUIZ_MEMBERS, type QuizQuestion } from '@/lib/quiz';

interface QuizPageProps {
  group: { kind: 'circle' | 'event'; id: string };
  onBack: () => void;
  onSelectPerson: (id: string) => void;
}

type Status = 'loading' | 'active' | 'results' | 'empty';

interface AnswerRecord {
  personId: string;
  correct: boolean;
}

export function QuizPage({ group, onBack, onSelectPerson }: QuizPageProps) {
  const { kind, id } = group;
  const { data: circles = [], isLoading: circlesLoading } = useCircles();
  const { data: events = [], isLoading: eventsLoading } = useEvents({ includeArchived: true });
  const { data: people = [], isLoading: peopleLoading } = usePersons();
  const { data: personCircles = [], isLoading: pcLoading } = usePersonCircles();
  const { data: personEvents = [], isLoading: peLoading } = usePersonEvents();

  const swipe = useSwipeBack(onBack);

  const groupName = useMemo(() => {
    const g = kind === 'circle' ? circles.find((c) => c.id === id) : events.find((e) => e.id === id);
    return g?.name ?? '';
  }, [kind, id, circles, events]);

  const memberIds = useMemo(() => (
    kind === 'circle'
      ? personCircles.filter((pc) => pc.circle_id === id).map((pc) => pc.person_id)
      : personEvents.filter((pe) => pe.event_id === id).map((pe) => pe.person_id)
  ), [kind, id, personCircles, personEvents]);

  const members = useMemo(() => people.filter((p) => memberIds.includes(p.id)), [people, memberIds]);

  const dataLoading = peopleLoading
    || (kind === 'circle' ? circlesLoading || pcLoading : eventsLoading || peLoading);

  const [status, setStatus] = useState<Status>('loading');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [results, setResults] = useState<Map<string, AnswerRecord>>(new Map());
  const [regenKey, setRegenKey] = useState(0);

  // Keep the latest members/name available to the generation effect without
  // forcing it to re-run on every query revalidation.
  const latest = useRef({ members, groupName });
  latest.current = { members, groupName };

  useEffect(() => {
    if (dataLoading) return;
    let cancelled = false;
    setStatus('loading');
    setIndex(0);
    setSelected(null);
    setResults(new Map());
    const { members: mem, groupName: name } = latest.current;
    if (mem.length < MIN_QUIZ_MEMBERS) {
      setStatus('empty');
      return;
    }
    generateQuiz({ kind, name }, mem).then((qs) => {
      if (cancelled) return;
      if (qs.length === 0) {
        setStatus('empty');
        return;
      }
      setQuestions(qs);
      setStatus('active');
    }).catch(() => {
      if (!cancelled) setStatus('empty');
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataLoading, regenKey, kind, id]);

  const current = questions[index];
  const answered = selected !== null;
  const score = useMemo(() => [...results.values()].filter((r) => r.correct).length, [results]);

  const handlePick = (option: string) => {
    if (answered || !current) return;
    const correct = option === current.answer;
    setSelected(option);
    setResults((prev) => {
      const next = new Map(prev);
      next.set(current.id, { personId: current.personId, correct });
      return next;
    });
    if (correct) haptics.success(); else haptics.error();
  };

  const handleNext = () => {
    haptics.light();
    if (index + 1 >= questions.length) {
      setStatus('results');
      return;
    }
    setIndex((i) => i + 1);
    setSelected(null);
  };

  const handleRetake = () => {
    haptics.medium();
    setRegenKey((k) => k + 1);
  };

  const missed = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const r of results.values()) {
      if (!r.correct && !seen.has(r.personId)) {
        seen.add(r.personId);
        list.push(r.personId);
      }
    }
    return list.map((pid) => members.find((m) => m.id === pid)).filter(Boolean) as typeof members;
  }, [results, members]);

  return (
    <div
      className="min-h-[100dvh] pb-10 animate-fade-in safe-top"
      style={{
        transform: swipe.offsetX > 0 ? `translateX(${swipe.offsetX}px)` : undefined,
        transition: swipe.dragging ? 'none' : 'transform 0.2s ease-out',
        touchAction: 'pan-y',
      }}
      {...swipe.bind}
    >
      {/* Nav bar */}
      <div
        className="sticky z-20 flex items-center justify-between px-3 pt-3 pb-2 border-b border-[hsl(0_0%_100%/0.06)] backdrop-blur-xl"
        style={{
          top: 'env(safe-area-inset-top)',
          background: 'linear-gradient(180deg, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.5) 60%, rgba(0,0,0,0.3) 100%)',
        }}
      >
        <button onClick={onBack} aria-label="Back" className="w-10 h-10 -ml-1 flex items-center justify-center text-foreground active:scale-95 transition-transform">
          <ArrowLeft className="w-5 h-5" strokeWidth={1.75} />
        </button>
        <h1 className="font-sans text-[17px] font-semibold text-foreground truncate px-2">
          Quiz · {groupName}
        </h1>
        <div className="w-10" />
      </div>

      {status === 'loading' && (
        <div className="flex flex-col items-center justify-center gap-3 py-24 px-6 text-center">
          <Loader2 className="w-7 h-7 animate-spin text-primary" />
          <p className="text-sm text-muted-text">Building your quiz…</p>
        </div>
      )}

      {status === 'empty' && (
        <div className="flex flex-col items-center justify-center gap-3 py-24 px-8 text-center">
          <Brain className="w-9 h-9 text-muted-text" strokeWidth={1.5} />
          <p className="text-[15px] font-display text-foreground">Not enough to quiz yet</p>
          <p className="text-[13px] text-muted-text leading-relaxed">
            Add at least {MIN_QUIZ_MEMBERS} people with a few details (a photo, where you met,
            what they do) and the quiz will have something to ask about.
          </p>
          <button
            onClick={onBack}
            className="mt-2 glass-pill h-11 px-5 inline-flex items-center text-[13px] text-foreground active:scale-[0.98] transition-transform"
          >
            Back to {kind === 'circle' ? 'Circle' : 'Event'}
          </button>
        </div>
      )}

      {status === 'active' && current && (
        <div className="px-5 pt-5">
          {/* Progress */}
          <div className="mb-5">
            <div className="flex items-center justify-between text-[12px] text-muted-text mb-2">
              <span>Question {index + 1} of {questions.length}</span>
              <span>{score} correct</span>
            </div>
            <div className="h-1.5 rounded-full bg-[hsl(0_0%_100%/0.08)] overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${((index + (answered ? 1 : 0)) / questions.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Prompt */}
          <h2 className="text-[22px] font-display text-foreground tracking-[-0.02em] leading-snug mb-4">
            {current.prompt}
          </h2>

          {/* Photo for photo_name questions */}
          {current.type === 'photo_name' && current.photoPath && (
            <div className="mb-5 flex justify-center">
              <PhotoImg
                path={current.photoPath}
                alt="Who is this?"
                className="w-44 h-44 rounded-2xl object-cover border border-[hsl(0_0%_100%/0.1)]"
              />
            </div>
          )}

          {/* Options */}
          <div className="space-y-2.5">
            {current.options.map((opt) => {
              const isAnswer = opt === current.answer;
              const isPicked = opt === selected;
              const state = !answered ? 'idle' : isAnswer ? 'correct' : isPicked ? 'wrong' : 'dim';
              return (
                <button
                  key={opt}
                  onClick={() => handlePick(opt)}
                  disabled={answered}
                  className={cn(
                    'w-full text-left px-4 py-3.5 rounded-xl border text-[15px] transition-colors flex items-center justify-between gap-2',
                    state === 'idle' && 'glass text-foreground active:scale-[0.99]',
                    state === 'correct' && 'bg-success/15 border-success text-foreground',
                    state === 'wrong' && 'bg-primary/15 border-primary text-foreground',
                    state === 'dim' && 'glass text-muted-text opacity-55',
                  )}
                >
                  <span className="min-w-0">{opt}</span>
                  {state === 'correct' && <Check className="w-4 h-4 text-success shrink-0" strokeWidth={2.25} />}
                  {state === 'wrong' && <X className="w-4 h-4 text-primary shrink-0" strokeWidth={2.25} />}
                </button>
              );
            })}
          </div>

          {/* Explanation + next */}
          {answered && (
            <div className="mt-5 animate-fade-in">
              {current.explanation && (
                <p className="text-[13px] font-display-italic text-[hsl(var(--foreground)/0.7)] mb-4 px-1">
                  {current.explanation}
                </p>
              )}
              <button
                onClick={handleNext}
                className="w-full h-[52px] rounded-2xl bg-primary text-primary-foreground font-semibold text-[15px] active:scale-[0.98] transition-transform inline-flex items-center justify-center gap-2"
              >
                {index + 1 >= questions.length ? 'See results' : 'Next'}
                <ChevronRight className="w-4 h-4" strokeWidth={2.25} />
              </button>
            </div>
          )}
        </div>
      )}

      {status === 'results' && (
        <ResultsScreen
          score={score}
          total={questions.length}
          groupName={groupName}
          missed={missed}
          onRetake={handleRetake}
          onDone={onBack}
          onSelectPerson={onSelectPerson}
        />
      )}
    </div>
  );
}

function ResultsScreen({
  score, total, groupName, missed, onRetake, onDone, onSelectPerson,
}: {
  score: number;
  total: number;
  groupName: string;
  missed: { id: string; name: string; photos: string[] }[];
  onRetake: () => void;
  onDone: () => void;
  onSelectPerson: (id: string) => void;
}) {
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  const headline = pct === 100 ? 'Perfect recall!'
    : pct >= 75 ? `You really know ${groupName}`
    : pct >= 50 ? 'Getting there'
    : 'Worth another pass';

  useEffect(() => { haptics.success(); }, []);

  return (
    <div className="px-5 pt-8 animate-fade-in">
      <div className="glass-warm rounded-2xl p-6 text-center mb-6">
        <Trophy className="w-9 h-9 text-primary mx-auto mb-3" strokeWidth={1.5} />
        <div className="text-[40px] font-display text-foreground leading-none">{score}/{total}</div>
        <p className="text-[14px] font-display-italic text-[hsl(var(--foreground)/0.7)] mt-2">{headline}</p>
      </div>

      {/* Be honest when the notes only supported a short quiz instead of
          padding it out with vague, multi-answer questions. */}
      {total < 6 && (
        <p className="text-[12px] text-muted-text text-center -mt-3 mb-6 px-3 leading-relaxed">
          Short quiz — that's all these notes could fairly cover. Add a few details
          (where you met, what they do) to unlock more questions.
        </p>
      )}

      {missed.length > 0 && (
        <>
          <h3 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-text mb-3 px-1">
            Brush up on these
          </h3>
          <div className="space-y-2 mb-6">
            {missed.map((p) => (
              <button
                key={p.id}
                onClick={() => onSelectPerson(p.id)}
                className="w-full glass rounded-xl px-3 py-2.5 flex items-center gap-3 active:scale-[0.99] transition-transform"
              >
                <PersonAvatar name={p.name} photo={p.photos?.[0]} size="sm" />
                <span className="text-[14px] text-foreground flex-1 text-left truncate">{p.name}</span>
                <ChevronRight className="w-4 h-4 text-muted-text shrink-0" strokeWidth={1.75} />
              </button>
            ))}
          </div>
        </>
      )}

      <div className="flex gap-2">
        <button
          onClick={onRetake}
          className="flex-1 h-[52px] rounded-2xl glass-pill inline-flex items-center justify-center gap-2 text-[14px] font-medium text-foreground active:scale-[0.98] transition-transform"
        >
          <RotateCcw className="w-4 h-4" strokeWidth={1.75} />
          New quiz
        </button>
        <button
          onClick={onDone}
          className="flex-1 h-[52px] rounded-2xl bg-primary text-primary-foreground font-semibold text-[14px] active:scale-[0.98] transition-transform"
        >
          Done
        </button>
      </div>
    </div>
  );
}
