import { useState } from 'react';
import { ChevronDown, Loader2, Pencil, Plus, Users, X } from 'lucide-react';
import { PersonAvatar } from '@/components/PersonAvatar';
import { haptics } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import { sourceLabel } from './sourceLabels';
import type { ImportCandidateRow as ImportCandidate } from '@/lib/import/types';

interface ImportCandidateRowProps {
  candidate: ImportCandidate;
  matchedPersonId?: string;
  onPromote: (bullets: string[]) => Promise<void> | void;
  onDismiss: () => void;
  onMerge?: (personId: string) => Promise<void> | void;
}

/**
 * Compact list row for the review step. Name + meta on top, three small
 * action icons on the right (edit, add, dismiss). Tapping edit expands a
 * collapsible drawer with the editable AI bullets + rationale; the row
 * stays slim by default so the user can scan a screenful of candidates at
 * once before deciding what to keep.
 */
export function ImportCandidateRow({
  candidate,
  matchedPersonId,
  onPromote,
  onDismiss,
  onMerge,
}: ImportCandidateRowProps) {
  const initialBullets = ((candidate.ai_bullets as string[] | null) || []).join('\n');
  const [bulletsText, setBulletsText] = useState(initialBullets);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState<'promote' | 'merge' | null>(null);

  const meta: string[] = [];
  if (candidate.title) meta.push(candidate.title);
  if (candidate.company) meta.push(candidate.company);
  if (meta.length === 0 && candidate.email) meta.push(candidate.email);

  const handlePromote = async () => {
    setBusy('promote');
    haptics.medium();
    try {
      const bullets = bulletsText
        .split('\n')
        .map((s) => s.replace(/^\s*[•\-*]\s*/, '').trim())
        .filter(Boolean);
      if (matchedPersonId && onMerge) {
        setBusy('merge');
        await onMerge(matchedPersonId);
      } else {
        await onPromote(bullets);
      }
    } finally {
      setBusy(null);
    }
  };

  const handleDismiss = () => {
    haptics.light();
    onDismiss();
  };

  const toggleExpanded = () => {
    haptics.selection();
    setExpanded((v) => !v);
  };

  return (
    <div className={cn('glass p-3', expanded && 'glass-warm')}>
      <div className="flex items-center gap-3">
        <PersonAvatar name={candidate.name} photo={candidate.photo_path || undefined} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-display text-[15px] text-foreground truncate leading-tight">
              {candidate.name}
            </span>
            {matchedPersonId && (
              <span className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-[hsl(0_0%_100%/0.06)] text-[9px] text-[hsl(var(--foreground)/0.7)] uppercase tracking-wider">
                <Users className="w-2.5 h-2.5" strokeWidth={1.75} />
                In People
              </span>
            )}
          </div>
          <div className="text-[11px] text-[hsl(var(--foreground)/0.55)] truncate">
            {meta.length > 0 ? meta.join(' · ') : `From ${sourceLabel(candidate.source)}`}
          </div>
        </div>
        <button
          onClick={toggleExpanded}
          aria-label={expanded ? 'Collapse' : 'Edit bullets'}
          className="w-9 h-9 rounded-full flex items-center justify-center text-[hsl(var(--foreground)/0.65)] active:scale-95 transition-transform"
        >
          {expanded ? <ChevronDown className="w-4 h-4" strokeWidth={1.75} /> : <Pencil className="w-3.5 h-3.5" strokeWidth={1.75} />}
        </button>
        <button
          onClick={handlePromote}
          disabled={!!busy}
          aria-label={matchedPersonId ? 'Merge in' : 'Add to People'}
          className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" strokeWidth={2.25} />}
        </button>
        <button
          onClick={handleDismiss}
          disabled={!!busy}
          aria-label="Dismiss"
          className="w-9 h-9 rounded-full flex items-center justify-center text-[hsl(var(--foreground)/0.55)] active:scale-95 transition-transform disabled:opacity-50"
        >
          <X className="w-4 h-4" strokeWidth={1.75} />
        </button>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-[hsl(0_0%_100%/0.08)]">
          {candidate.ai_rationale && (
            <p className="font-display-italic text-[11px] text-[hsl(var(--foreground)/0.55)] mb-2 leading-snug">
              {candidate.ai_rationale}
            </p>
          )}
          <label className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[hsl(var(--foreground)/0.55)]">
            About (editable)
          </label>
          <textarea
            value={bulletsText}
            onChange={(e) => setBulletsText(e.target.value)}
            rows={Math.max(3, Math.min(6, bulletsText.split('\n').length))}
            placeholder="One bullet per line"
            className="glass-input w-full mt-1 p-2.5 text-[12px] leading-snug resize-none"
          />
        </div>
      )}
    </div>
  );
}
