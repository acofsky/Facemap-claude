import { useState } from 'react';
import { Loader2, Plus, X, Users } from 'lucide-react';
import { PersonAvatar } from '@/components/PersonAvatar';
import { haptics } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import { sourceLabel } from './sourceLabels';
import type { ImportCandidateRow } from '@/lib/import/types';

interface ImportCandidateCardProps {
  candidate: ImportCandidateRow;
  matchedPersonId?: string;
  onPromote: (bullets: string[]) => Promise<void> | void;
  onDismiss: () => void;
  onMerge?: (personId: string) => Promise<void> | void;
}

/**
 * Single review-step card. Shows photo+name+source+rationale, the editable
 * AI bullets that'll seed the About field, and Promote/Dismiss actions.
 * When the candidate matches an existing Person, swap Promote for Merge
 * to avoid creating a duplicate row.
 */
export function ImportCandidateCard({
  candidate,
  matchedPersonId,
  onPromote,
  onDismiss,
  onMerge,
}: ImportCandidateCardProps) {
  const initialBullets = ((candidate.ai_bullets as string[] | null) || []).join('\n');
  const [bulletsText, setBulletsText] = useState(initialBullets);
  const [busy, setBusy] = useState<'promote' | 'merge' | 'dismiss' | null>(null);

  const handlePromote = async () => {
    setBusy('promote');
    haptics.medium();
    try {
      const bullets = bulletsText
        .split('\n')
        .map((s) => s.replace(/^\s*[•\-*]\s*/, '').trim())
        .filter(Boolean);
      await onPromote(bullets);
    } finally {
      setBusy(null);
    }
  };

  const handleMerge = async () => {
    if (!matchedPersonId || !onMerge) return;
    setBusy('merge');
    haptics.medium();
    try {
      await onMerge(matchedPersonId);
    } finally {
      setBusy(null);
    }
  };

  const handleDismiss = () => {
    setBusy('dismiss');
    haptics.light();
    onDismiss();
  };

  const meta: string[] = [];
  if (candidate.title) meta.push(candidate.title);
  if (candidate.company) meta.push(candidate.company);

  return (
    <div className="glass p-4">
      <div className="flex items-start gap-3">
        <PersonAvatar name={candidate.name} photo={candidate.photo_path || undefined} size="md" />
        <div className="min-w-0 flex-1">
          <div className="font-display text-[17px] text-foreground truncate leading-tight">
            {candidate.name}
          </div>
          {meta.length > 0 && (
            <div className="text-[12px] text-[hsl(var(--foreground)/0.65)] truncate mt-0.5">
              {meta.join(' · ')}
            </div>
          )}
          <div className="text-[11px] text-[hsl(var(--foreground)/0.45)] mt-0.5">
            From {sourceLabel(candidate.source)}
          </div>
        </div>
        {matchedPersonId && (
          <div className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[hsl(0_0%_100%/0.06)] text-[10px] text-[hsl(var(--foreground)/0.7)] uppercase tracking-wider">
            <Users className="w-3 h-3" strokeWidth={1.75} />
            In People
          </div>
        )}
      </div>

      {candidate.ai_rationale && (
        <p className="font-display-italic text-[12px] text-[hsl(var(--foreground)/0.55)] mt-3 leading-snug">
          {candidate.ai_rationale}
        </p>
      )}

      <div className="mt-3">
        <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[hsl(var(--foreground)/0.55)]">
          About (editable)
        </label>
        <textarea
          value={bulletsText}
          onChange={(e) => setBulletsText(e.target.value)}
          rows={Math.max(3, Math.min(6, bulletsText.split('\n').length))}
          placeholder="One bullet per line"
          className={cn('glass-input w-full mt-1.5 p-2.5 text-[13px] leading-snug resize-none')}
        />
      </div>

      <div className="flex items-center gap-2 mt-3">
        {matchedPersonId && onMerge ? (
          <button
            onClick={handleMerge}
            disabled={!!busy}
            className="flex-1 h-11 rounded-2xl bg-primary text-primary-foreground font-semibold text-[14px] active:scale-[0.98] transition-transform disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
          >
            {busy === 'merge' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" strokeWidth={2} />}
            Merge in
          </button>
        ) : (
          <button
            onClick={handlePromote}
            disabled={!!busy}
            className="flex-1 h-11 rounded-2xl bg-primary text-primary-foreground font-semibold text-[14px] active:scale-[0.98] transition-transform disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
          >
            {busy === 'promote' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" strokeWidth={2} />}
            Add to People
          </button>
        )}
        <button
          onClick={handleDismiss}
          disabled={!!busy}
          aria-label="Dismiss"
          className="glass-pill !h-11 !w-11 !p-0 flex items-center justify-center text-[hsl(var(--foreground)/0.65)] active:scale-95 transition-transform disabled:opacity-50"
        >
          <X className="w-4 h-4" strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}
