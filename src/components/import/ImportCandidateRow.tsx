import { Check, Loader2, Pencil, Plus, Users, X } from 'lucide-react';
import { PersonAvatar } from '@/components/PersonAvatar';
import { haptics } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import { sourceLabel } from './sourceLabels';
import type { ImportCandidateRow as ImportCandidate } from '@/lib/import/types';

interface ImportCandidateRowProps {
  candidate: ImportCandidate;
  matchedPersonId?: string;
  busy?: boolean;
  /** Click the row body, the name, or the pencil icon. */
  onReview: () => void;
  /** Quick action — promotes (or merges, when matched) with the source's
   *  defaults, no per-field editing. */
  onPromote: () => void;
  onDismiss: () => void;
  /** When true, the row is in multi-select mode: tapping the body toggles
   *  selection instead of opening review, the avatar is replaced by a
   *  checkbox, and the per-row action buttons are hidden (the batch action
   *  bar handles adding the selected set). */
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}

/**
 * Compact list row. Body click opens the full review sheet. The +/×
 * icons stay on the row for quick triage; the pencil also opens the
 * full sheet so the user has an explicit "edit" affordance even though
 * tapping the row works too.
 */
export function ImportCandidateRow({
  candidate,
  matchedPersonId,
  busy,
  onReview,
  onPromote,
  onDismiss,
  selectMode,
  selected,
  onToggleSelect,
}: ImportCandidateRowProps) {
  const meta: string[] = [];
  if (candidate.title) meta.push(candidate.title);
  if (candidate.company) meta.push(candidate.company);
  if (meta.length === 0 && candidate.email) meta.push(candidate.email);

  const handleReview = () => {
    haptics.selection();
    onReview();
  };

  const handleRowClick = () => {
    if (selectMode) {
      haptics.selection();
      onToggleSelect?.();
    } else {
      handleReview();
    }
  };

  const handlePromote = (e: React.MouseEvent) => {
    e.stopPropagation();
    haptics.medium();
    onPromote();
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    haptics.light();
    onDismiss();
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleReview();
  };

  return (
    <button
      type="button"
      onClick={handleRowClick}
      className={cn(
        'glass p-3 w-full text-left active:bg-[hsl(0_0%_100%/0.04)] transition-colors',
        selectMode && selected && 'ring-1 ring-primary/70 bg-[hsl(var(--primary)/0.08)]',
      )}
    >
      <div className="flex items-center gap-3">
        {selectMode ? (
          <span
            className={cn(
              'w-9 h-9 shrink-0 rounded-full flex items-center justify-center border transition-colors',
              selected
                ? 'bg-primary border-primary text-primary-foreground'
                : 'border-[hsl(0_0%_100%/0.25)] text-transparent',
            )}
          >
            <Check className="w-4 h-4" strokeWidth={2.5} />
          </span>
        ) : (
          <PersonAvatar
            name={candidate.name}
            photo={candidate.photo_path || undefined}
            size="sm"
          />
        )}
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
        {!selectMode && (
          <>
            <button
              type="button"
              onClick={handleEdit}
              disabled={busy}
              aria-label="Review and edit"
              className={cn(
                'w-9 h-9 rounded-full flex items-center justify-center text-[hsl(var(--foreground)/0.65)] active:scale-95 transition-transform disabled:opacity-50',
              )}
            >
              <Pencil className="w-3.5 h-3.5" strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onClick={handlePromote}
              disabled={busy}
              aria-label={matchedPersonId ? 'Merge in' : 'Add to People'}
              className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" strokeWidth={2.25} />}
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              disabled={busy}
              aria-label="Dismiss"
              className="w-9 h-9 rounded-full flex items-center justify-center text-[hsl(var(--foreground)/0.55)] active:scale-95 transition-transform disabled:opacity-50"
            >
              <X className="w-4 h-4" strokeWidth={1.75} />
            </button>
          </>
        )}
      </div>
    </button>
  );
}
