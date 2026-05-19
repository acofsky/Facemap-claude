import { motion } from 'framer-motion';
import {
  ArrowLeft, Users, Search, LayoutGrid, Sparkles, Camera, CalendarPlus,
} from 'lucide-react';
import { useSwipeBack } from '@/hooks/use-swipe-back';

interface UseCasesPageProps {
  onBack: () => void;
}

interface Scenario {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  /** The networking story is the flagship — it gets the single red accent. */
  accent?: boolean;
  title: string;
  body: string;
  features: string[];
}

const SCENARIOS: Scenario[] = [
  {
    icon: Users,
    accent: true,
    title: 'At a networking event',
    body:
      "You meet a colleague at a mixer and have two seconds — tap the red +, type his name, done. That night Membr asks “Who'd you meet today?” so you add that he's a VP at Acme and his daughter just started at Berkeley. Months later, before a follow-up call, you pull a Brief — and remember to ask how she's settling in. He lights up.",
    features: ['Add Person', 'End-of-day reminder', 'Brief'],
  },
  {
    icon: Search,
    title: 'The name on the tip of your tongue',
    body:
      "Across the room at a wedding — you know that face, but the name is gone. Open Recall and describe what you remember: “tall, beard, met at Sarah's birthday.” Membr finds him. You walk over and greet Marcus by name.",
    features: ['Recall'],
  },
  {
    icon: LayoutGrid,
    title: 'Keep your circles straight',
    body:
      'Work contacts, gym regulars, college friends — they blur together. Group them into Circles, then skim the Gym circle before Saturday class so every name is already loaded.',
    features: ['Circles'],
  },
  {
    icon: Sparkles,
    title: 'A whole trip, grouped',
    body:
      "Home from a four-day conference and 30 new faces? Make an Event — “SaaS Summit 2026” — tag everyone as you add them, and the whole cohort stays together, searchable for good.",
    features: ['Events'],
  },
  {
    icon: Camera,
    title: 'Put a face to the name',
    body:
      "Add a photo when you log someone new and Membr's AI writes a quick description — “curly hair, round glasses, usually in denim.” Months later, the face still clicks.",
    features: ['AI photo description'],
  },
  {
    icon: CalendarPlus,
    title: 'Never lose the thread',
    body:
      "Ran into an old client at a coffee shop — swipe their row, tap Log, jot “mentioned they're hiring.” Next time, you pick up exactly where you left off.",
    features: ['Log encounter'],
  },
];

/**
 * "Ways to use Membr" — a scenario-driven feature showcase reached from a
 * button at the bottom of Home. Each card tells a short, concrete story
 * so users see when and how to reach for each feature.
 */
export function UseCasesPage({ onBack }: UseCasesPageProps) {
  const swipe = useSwipeBack(onBack);

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 36, stiffness: 380 }}
      className="fixed inset-0 z-[60] max-w-md mx-auto"
    >
      {/* Inner layer carries the swipe-back transform so it never fights
          Framer Motion's entry/exit animation on the wrapper above. */}
      <div
        className="absolute inset-0 bg-background flex flex-col safe-top safe-bottom"
        style={{
          transform: swipe.offsetX > 0 ? `translateX(${swipe.offsetX}px)` : undefined,
          transition: swipe.dragging ? 'none' : 'transform 0.2s ease-out',
          touchAction: 'pan-y',
        }}
        {...swipe.bind}
      >
      {/* Nav bar */}
      <div className="bg-background flex items-center justify-between px-3 pt-3 pb-2 border-b border-[hsl(0_0%_100%/0.06)]">
        <button
          onClick={onBack}
          aria-label="Back"
          className="w-10 h-10 -ml-1 flex items-center justify-center text-foreground active:scale-95 transition-transform"
        >
          <ArrowLeft className="w-5 h-5" strokeWidth={1.75} />
        </button>
        <h1 className="font-sans text-[17px] font-semibold text-foreground">Ways to use Membr</h1>
        <span className="w-10" />
      </div>

      <div className="overflow-y-auto scrollbar-hide flex-1 px-5 pt-5 pb-12">
        <p className="text-[14px] text-muted-text leading-relaxed mb-6">
          Membr earns its keep in the small moments. Here's how it fits into
          real situations — so every feature is working for you.
        </p>

        <div className="space-y-3">
          {SCENARIOS.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.title}
                className="rounded-lg bg-surface-1 border border-[hsl(0_0%_100%/0.08)] p-4"
              >
                <div className="flex items-center gap-2.5 mb-2">
                  <span
                    className={
                      s.accent
                        ? 'w-8 h-8 rounded-md tile-red flex items-center justify-center shrink-0'
                        : 'w-8 h-8 rounded-md bg-surface-2 border border-[hsl(0_0%_100%/0.1)] flex items-center justify-center shrink-0'
                    }
                  >
                    <Icon
                      className={s.accent ? 'w-4 h-4 text-white' : 'w-4 h-4 text-muted-text'}
                      strokeWidth={1.75}
                    />
                  </span>
                  <h2 className="font-display text-[18px] text-foreground tracking-[-0.02em] leading-tight">
                    {s.title}
                  </h2>
                </div>
                <p className="text-[13px] text-foreground/80 leading-relaxed">
                  {s.body}
                </p>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {s.features.map((f) => (
                    <span
                      key={f}
                      className="text-[11px] font-medium text-muted-text px-2 py-0.5 rounded-sm bg-[hsl(0_0%_100%/0.05)]"
                    >
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-[13px] text-muted-text italic leading-relaxed mt-6 text-center">
          Every detail you capture makes the next conversation better.
        </p>
      </div>
      </div>
    </motion.div>
  );
}
