import { useState } from 'react';
import { Linkedin, ExternalLink, Link2Off, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useUpdatePerson } from '@/hooks/use-data';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';

interface Props {
  personId: string;
  linkedinUrl: string | null;
}

/**
 * Normalize a pasted LinkedIn value into a full https URL, or null if it
 * doesn't look like LinkedIn. Accepts bare forms ("linkedin.com/in/jane",
 * "www.linkedin.com/in/jane") by prepending the scheme. We only require the
 * host to be linkedin.com so company/profile/post URLs all pass.
 */
export function normalizeLinkedInUrl(raw: string): string | null {
  let v = raw.trim();
  if (!v) return null;
  if (!/^https?:\/\//i.test(v)) v = `https://${v}`;
  let host: string;
  try {
    host = new URL(v).hostname.toLowerCase();
  } catch {
    return null;
  }
  if (!/(^|\.)linkedin\.com$/.test(host)) return null;
  return v;
}

/** Short, human-readable label for a linked profile — the "/in/jane" slug
 *  when present, else a generic "LinkedIn profile". */
function profileLabel(url: string): string {
  try {
    const path = new URL(url).pathname.replace(/\/+$/, '');
    const m = path.match(/\/(in|company)\/([^/]+)/i);
    if (m) return `${m[1].toLowerCase()}/${decodeURIComponent(m[2])}`;
  } catch { /* fall through */ }
  return 'LinkedIn profile';
}

/**
 * Compact, single-row LinkedIn link control for the person detail "Links"
 * section. Sits below the (unchanged) iPhone Contact card. Two states:
 * unlinked → one slim "Add LinkedIn" row that opens a paste dialog; linked
 * → one slim row with Open (system browser / LinkedIn app) and Unlink.
 *
 * Unlike the iPhone Contact card this needs no native gating — saving a URL
 * and opening it work in the web preview too.
 */
export function LinkedInLinkSection({ personId, linkedinUrl }: Props) {
  const updatePerson = useUpdatePerson();
  const [busy, setBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState('');

  const openEditor = () => {
    setDraft(linkedinUrl ?? '');
    setEditOpen(true);
  };

  const handleSave = async () => {
    const normalized = normalizeLinkedInUrl(draft);
    if (!normalized) {
      toast.error('That doesn’t look like a LinkedIn URL.');
      return;
    }
    setBusy(true);
    try {
      await updatePerson.mutateAsync({ id: personId, updates: { linkedin_url: normalized } });
      toast.success('LinkedIn linked');
      setEditOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not link LinkedIn');
    } finally {
      setBusy(false);
    }
  };

  const handleUnlink = async () => {
    setBusy(true);
    try {
      await updatePerson.mutateAsync({ id: personId, updates: { linkedin_url: null } });
      toast.success('Unlinked');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not unlink');
    } finally {
      setBusy(false);
    }
  };

  // Open externally — Capacitor routes a target=_blank https URL through
  // UIApplication.open, so iOS hands linkedin.com to the LinkedIn app when
  // it's installed and falls back to Safari otherwise.
  const handleOpen = () => {
    if (!linkedinUrl) return;
    window.open(linkedinUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <>
      {linkedinUrl ? (
        <div className="glass p-3 flex items-center gap-2.5">
          <Linkedin className="w-4 h-4 text-foreground shrink-0" strokeWidth={1.75} />
          <span className="text-[13px] text-foreground flex-1 min-w-0 truncate">
            {profileLabel(linkedinUrl)}
          </span>
          <button
            onClick={handleOpen}
            className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md bg-surface-2 border border-[hsl(0_0%_100%/0.12)] text-[12px] font-medium text-foreground hover:border-[hsl(0_0%_100%/0.18)] transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.75} />
            Open
          </button>
          <button
            onClick={handleUnlink}
            disabled={busy}
            aria-label="Unlink LinkedIn"
            className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-surface-2 border border-[hsl(0_0%_100%/0.12)] text-muted-text hover:border-[hsl(0_0%_100%/0.18)] hover:text-foreground transition-colors disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2Off className="w-3.5 h-3.5" strokeWidth={1.75} />}
          </button>
        </div>
      ) : (
        <button
          onClick={openEditor}
          className="glass w-full p-3 flex items-center gap-2.5 text-left active:scale-[0.99] transition-transform"
        >
          <Linkedin className="w-4 h-4 text-muted-text shrink-0" strokeWidth={1.75} />
          <span className="text-[13px] font-medium text-foreground flex-1">Add LinkedIn</span>
          <Plus className="w-4 h-4 text-muted-text shrink-0" strokeWidth={1.75} />
        </button>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-sm bg-surface-2 border border-[hsl(0_0%_100%/0.12)]">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2 tracking-[-0.02em]">
              <Linkedin className="w-5 h-5 text-primary" strokeWidth={1.75} /> Link LinkedIn
            </DialogTitle>
            <DialogDescription className="text-[12px] text-muted-text">
              Paste their LinkedIn profile URL. Opening it later routes to the LinkedIn app if you have it.
            </DialogDescription>
          </DialogHeader>

          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            placeholder="linkedin.com/in/their-name"
            className="w-full h-11 px-3.5 rounded-md bg-surface-1 border border-[hsl(0_0%_100%/0.08)] text-sm text-foreground placeholder:text-muted-text focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/15 transition-colors"
          />

          <DialogFooter className="gap-2 sm:gap-2">
            <button
              onClick={() => setEditOpen(false)}
              className="px-4 h-10 rounded-md bg-surface-2 border border-[hsl(0_0%_100%/0.12)] text-muted-text text-sm font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={busy || !draft.trim()}
              className="inline-flex items-center justify-center gap-2 px-4 h-10 rounded-md bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {busy ? 'Saving…' : 'Save'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
