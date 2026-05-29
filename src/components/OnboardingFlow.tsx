import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Calendar, MapPin, Users, Upload } from 'lucide-react';
import { Wordmark } from '@/components/Wordmark';
import { haptics } from '@/lib/haptics';
import { cn } from '@/lib/utils';

interface OnboardingFlowProps {
  onDone: () => void;
}

interface Screen {
  headline: string;
  sub?: string;
  cta: string;
  illustration: () => JSX.Element;
  /** Optional secondary CTA shown beneath the primary one. */
  secondaryCta?: string;
  /** If set, tapping the primary CTA stashes a flag the main app reads on
   *  mount to auto-open the corresponding flow (e.g. Smart Import). */
  primarySideEffect?: 'open-import';
}

const SCREENS: Screen[] = [
  {
    headline: 'Be the person everyone remembers meeting.',
    sub: "Membr is your private memory layer for the people you encounter — names, faces, context, and what to say next time.",
    cta: 'Continue',
    illustration: WelcomeIllustration,
  },
  {
    headline: 'Name. Two lines. Done.',
    sub: "Add Person is one tap. The rest is optional — but the more context you capture, the sharper your future briefs.",
    cta: 'Got it',
    illustration: AddIllustration,
  },
  {
    headline: 'Everyone lives somewhere.',
    sub: 'Circles for your ongoing groups. Events for one-off scenes — a trip, a dinner, a conference.',
    cta: 'Makes sense',
    illustration: GroupsIllustration,
  },
  {
    headline: 'Walk in already winning.',
    sub: 'Before you see someone, pull a 30-second brief. Their name, context, what to ask. Every time.',
    cta: "Let's go",
    illustration: BriefIllustration,
  },
  {
    headline: 'Bring your people in.',
    sub: 'Pull from Contacts, LinkedIn, or any file — spreadsheets and photos work. Describe who you want and AI surfaces your best 20 first.',
    cta: 'Import people now',
    secondaryCta: 'Maybe later',
    illustration: ImportIllustration,
    primarySideEffect: 'open-import',
  },
];

export function OnboardingFlow({ onDone }: OnboardingFlowProps) {
  const [index, setIndex] = useState(0);
  const screen = SCREENS[index];
  const isLast = index === SCREENS.length - 1;

  const advance = () => {
    haptics.light();
    if (screen.primarySideEffect === 'open-import') {
      try { window.localStorage.setItem('membr.pendingImport', '1'); } catch { /* ignore quota */ }
    }
    if (isLast) onDone();
    else setIndex((i) => i + 1);
  };

  const skip = () => {
    haptics.light();
    onDone();
  };

  const secondary = () => {
    haptics.light();
    if (isLast) onDone();
    else setIndex((i) => i + 1);
  };

  return (
    <div className="fixed inset-0 z-[60] ambient-backdrop overflow-hidden flex flex-col safe-top safe-bottom">
      {/* Top row: dots + skip */}
      <div className="flex items-center justify-between px-5 pt-3 pb-2">
        <span className="w-12" />
        <div className="flex items-center gap-1.5">
          {SCREENS.map((_, i) => (
            <span
              key={i}
              className={cn(
                'h-1.5 rounded-full transition-all',
                i === index ? 'w-5 bg-primary' : 'w-1.5 bg-[hsl(0_0%_100%/0.18)]',
              )}
            />
          ))}
        </div>
        {isLast ? (
          <span className="w-12" aria-hidden="true" />
        ) : (
          <button
            type="button"
            onClick={skip}
            className="text-[14px] font-medium text-[hsl(var(--foreground)/0.55)] px-2 py-2 -mr-2 active:opacity-60 transition-opacity"
          >
            Skip
          </button>
        )}
      </div>

      {/* Slide content */}
      <div className="flex-1 flex flex-col items-center justify-center px-7 -mt-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="w-full flex flex-col items-center"
          >
            {/* Illustration */}
            <div className="mb-9 w-full max-w-[280px]">
              <screen.illustration />
            </div>

            {/* Headline */}
            <h1 className="font-display text-[32px] leading-[1.1] text-foreground text-center tracking-[-0.02em]">
              {screen.headline}
            </h1>
            {screen.sub && (
              <p className="text-[14px] text-[hsl(var(--foreground)/0.65)] text-center leading-relaxed mt-3 max-w-[300px]">
                {screen.sub}
              </p>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* CTA */}
      <div className="px-5 pb-6 space-y-2">
        <button
          onClick={advance}
          className="w-full h-[52px] rounded-2xl bg-primary text-primary-foreground font-semibold text-[15px] active:scale-[0.98] transition-transform"
        >
          {screen.cta}
        </button>
        {screen.secondaryCta && (
          <button
            onClick={secondary}
            className="w-full h-[44px] rounded-2xl text-[14px] font-medium text-[hsl(var(--foreground)/0.65)] active:opacity-60 transition-opacity"
          >
            {screen.secondaryCta}
          </button>
        )}
      </div>
    </div>
  );
}

/* ----------------------- illustrations ----------------------- */

function WelcomeIllustration() {
  // ONBD-01 — render an actual Membr person card mock + the wordmark overhead.
  return (
    <div className="flex flex-col items-center gap-5">
      <Wordmark className="text-[40px]" />
      <PersonCardMock name="Alex Chen" hint="From the design conference · Tribeca" />
    </div>
  );
}

function AddIllustration() {
  // ONBD-02 — simplified Add Person sheet preview.
  return (
    <div className="glass p-4 space-y-2.5 w-full">
      <div className="flex justify-center">
        <div className="w-16 h-16 rounded-full bg-[hsl(0_0%_100%/0.05)] border border-dashed border-[hsl(0_0%_100%/0.18)] flex items-center justify-center">
          <Users className="w-5 h-5 text-muted-text" strokeWidth={1.75} />
        </div>
      </div>
      <FakeInput value="Maya" />
      <FakeInput value="Yoga class · Saturday morning" />
      <div className="pt-1">
        <div className="w-full h-10 rounded-md bg-primary flex items-center justify-center text-primary-foreground text-[13px] font-semibold">
          Save Person
        </div>
      </div>
    </div>
  );
}

function GroupsIllustration() {
  // ONBD-03 — two Circle tiles + one Event tile.
  return (
    <div className="space-y-3 w-full">
      <div className="grid grid-cols-2 gap-3">
        <div className="aspect-[3/2] rounded-xl tile-blue p-3 flex flex-col justify-end">
          <div className="text-[13px] font-semibold text-white">Work</div>
          <div className="text-[11px] text-white/70">12 members</div>
        </div>
        <div className="aspect-[3/2] rounded-xl tile-green p-3 flex flex-col justify-end">
          <div className="text-[13px] font-semibold text-white">Climbing gym</div>
          <div className="text-[11px] text-white/70">5 members</div>
        </div>
      </div>
      <div className="aspect-[5/2] rounded-xl tile-red p-3 flex flex-col justify-end">
        <div className="text-[13px] font-semibold text-white">Spring conference</div>
        <div className="flex items-center justify-between mt-0.5">
          <span className="text-[11px] text-white/70">7 members</span>
          <span className="text-[11px] text-white/60">Apr 14–16</span>
        </div>
      </div>
    </div>
  );
}

function ImportIllustration() {
  // ONBD-05 — stack of source chips with the AI-rank moment implied.
  return (
    <div className="space-y-2.5 w-full">
      <div className="glass-warm p-3.5 flex items-center gap-3">
        <div className="w-9 h-9 rounded-md bg-[hsl(0_0%_100%/0.08)] flex items-center justify-center">
          <Upload className="w-4 h-4 text-primary" strokeWidth={1.75} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold text-foreground">Smart Import</div>
          <div className="text-[11px] text-[hsl(var(--foreground)/0.6)]">Contacts · LinkedIn · Photo</div>
        </div>
      </div>
      <div className="glass p-2.5 flex items-center gap-2">
        <div className="w-7 h-7 rounded-full tile-blue flex items-center justify-center text-white text-[11px] font-semibold">PM</div>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-semibold text-foreground truncate">Pat Morgan</div>
          <div className="text-[10px] text-[hsl(var(--foreground)/0.55)] truncate">Senior PM · Stripe</div>
        </div>
        <Sparkles className="w-3 h-3 text-primary" strokeWidth={1.75} />
      </div>
      <div className="glass p-2.5 flex items-center gap-2">
        <div className="w-7 h-7 rounded-full tile-purple flex items-center justify-center text-white text-[11px] font-semibold">AK</div>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-semibold text-foreground truncate">Aria Kim</div>
          <div className="text-[10px] text-[hsl(var(--foreground)/0.55)] truncate">Founder · seed-stage fintech</div>
        </div>
        <Sparkles className="w-3 h-3 text-primary" strokeWidth={1.75} />
      </div>
    </div>
  );
}

function BriefIllustration() {
  // ONBD-04 — simplified Meeting Brief card preview.
  return (
    <div className="glass p-4 w-full">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-primary" strokeWidth={1.75} />
        <span className="text-[13px] font-semibold text-foreground tracking-[-0.01em]">Brief: Maya</span>
      </div>
      <div className="space-y-1.5">
        <BriefLine icon={MapPin} text="Met at yoga class · 6 weeks ago" />
        <BriefLine icon={Users} text="Knows Sarah from your work circle" />
        <BriefLine icon={Calendar} text="Last seen 11 days ago" />
      </div>
      <div className="mt-3 text-[11px] inline-flex items-center gap-1 text-muted-text">
        <Sparkles className="w-3 h-3" strokeWidth={1.75} />
        AI generated
      </div>
    </div>
  );
}

/* ----------------------- small helpers ----------------------- */

function PersonCardMock({ name, hint }: { name: string; hint: string }) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('');
  return (
    <div className="w-full glass p-4 flex items-center gap-3">
      <div className="w-12 h-12 rounded-full tile-rose flex items-center justify-center text-white font-semibold">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[15px] font-semibold text-foreground truncate">{name}</div>
        <div className="text-[12px] text-muted-text truncate">{hint}</div>
      </div>
    </div>
  );
}

function FakeInput({ value }: { value: string }) {
  return (
    <div className="glass-input w-full h-10 flex items-center px-3.5 text-[13px] text-foreground">
      {value}
    </div>
  );
}

function BriefLine({
  icon: Icon,
  text,
}: {
  icon: (p: { className?: string; strokeWidth?: number }) => JSX.Element;
  text: string;
}) {
  return (
    <div className="flex items-start gap-2 text-[12px] text-foreground/90 leading-snug">
      <Icon className="w-3 h-3 mt-0.5 shrink-0 text-muted-text" strokeWidth={1.75} />
      <span>{text}</span>
    </div>
  );
}
