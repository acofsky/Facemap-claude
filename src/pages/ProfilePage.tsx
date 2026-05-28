import { useState, type ComponentType } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/use-auth';
import { LogOut, X, Loader2, Bell, ShieldCheck, ChevronRight, AtSign, KeyRound, Pencil, Sparkles, Upload, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { friendlyError } from '@/lib/errors';
import { toast } from 'sonner';
import { AIDisclosure } from '@/components/AIDisclosure';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EnrichInfoModal } from '@/components/EnrichInfoModal';
import { NotificationPreferencesPage } from '@/pages/NotificationPreferencesPage';
import { AppPermissionsPage } from '@/pages/AppPermissionsPage';
import { cn } from '@/lib/utils';
import { useOnboarded } from '@/hooks/use-onboarded';

const APP_VERSION = '1.0.3';
const PRIVACY_POLICY_URL: string | null =
  'https://www.termsfeed.com/live/00f81b1d-cab0-4059-93ed-1103b7603d30';

interface ProfilePageProps {
  onOpenImport?: () => void;
}

export function ProfilePage({ onOpenImport }: ProfilePageProps = {}) {
  const { user, signOut } = useAuth();
  const { resetOnboarding } = useOnboarded();
  const [settingsOpen, setSettingsOpen] = useState<null | 'email' | 'password' | 'name'>(null);
  const [notifPrefsOpen, setNotifPrefsOpen] = useState(false);
  const [permsOpen, setPermsOpen] = useState(false);
  const [enrichInfoOpen, setEnrichInfoOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newFirstName, setNewFirstName] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [nameLoading, setNameLoading] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const currentFirstName =
    ((user?.user_metadata as { first_name?: string } | undefined)?.first_name ?? '').trim();

  const handleEmailUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || newEmail === user?.email) return;
    setEmailLoading(true);
    try {
      const { error } = await supabase.auth.updateUser(
        { email: newEmail },
        { emailRedirectTo: `${window.location.origin}/` },
      );
      if (error) throw error;
      toast.success('Check both your old and new email to confirm the change.');
      setNewEmail('');
      setSettingsOpen(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not update email.';
      toast.error(msg);
    } finally {
      setEmailLoading(false);
    }
  };

  const handleNameUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newFirstName.trim();
    if (!trimmed) return;
    setNameLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ data: { first_name: trimmed } });
      if (error) throw error;
      toast.success('Name updated.');
      setNewFirstName('');
      setSettingsOpen(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not update name.';
      toast.error(msg);
    } finally {
      setNameLoading(false);
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }
    setPwLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success('Password updated.');
      setNewPassword('');
      setConfirmPassword('');
      setSettingsOpen(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not update password.';
      toast.error(msg);
    } finally {
      setPwLoading(false);
    }
  };

  const handleSignOutConfirm = () => {
    if (confirm('Sign out of Membr?')) signOut();
  };

  const handleDeleteConfirmed = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase.functions.invoke('delete-account');
      if (error) throw error;
      await signOut();
      toast.success('Account deleted.');
    } catch (err) {
      toast.error(friendlyError(err, 'Could not delete your account. Try again.'));
      setDeleting(false);
      setDeleteConfirmOpen(false);
    }
  };

  const displayName =
    currentFirstName ||
    ((user?.user_metadata as { full_name?: string } | undefined)?.full_name) ||
    '';
  const initials = (displayName[0] || user?.email?.[0] || '?').toUpperCase();

  return (
    <div className="pb-10 animate-fade-in">
      <div className="sticky top-0 z-20 flex items-center justify-center pt-2 pb-3 mb-2">
        <h1 className="font-display text-[26px] tracking-[-0.02em] text-foreground">Profile</h1>
      </div>

      {/* User card — raised glass with serif name, red period, email, edit */}
      <div className="px-5 mb-7">
        <div className="glass glass-raised flex items-center gap-3.5 p-4">
          <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-display text-2xl">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            {displayName ? (
              <div className="font-display text-[22px] text-foreground truncate leading-tight">
                {displayName}<span className="text-primary">.</span>
              </div>
            ) : null}
            <div className={cn(
              'truncate',
              displayName
                ? 'text-[13px] text-[hsl(var(--foreground)/0.55)] mt-0.5'
                : 'font-display text-[20px] text-foreground'
            )}>
              {user?.email}
            </div>
          </div>
          <button
            onClick={() => {
              setNewFirstName(currentFirstName);
              setSettingsOpen('name');
            }}
            aria-label="Edit name"
            className="glass-pill !w-9 !h-9 !p-0 flex items-center justify-center text-foreground shrink-0"
          >
            <Pencil className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>
      </div>

      <SectionLabel>Account</SectionLabel>
      <SectionCard>
        <SettingRow
          icon={Pencil}
          label="Edit name"
          rightLabel={currentFirstName || 'Add'}
          onClick={() => {
            setNewFirstName(currentFirstName);
            setSettingsOpen('name');
          }}
        />
        <SettingRow
          icon={AtSign}
          label="Change email"
          onClick={() => setSettingsOpen('email')}
        />
        <SettingRow
          icon={KeyRound}
          label="Change password"
          onClick={() => setSettingsOpen('password')}
        />
        <SettingRow
          icon={LogOut}
          label="Sign out"
          onClick={handleSignOutConfirm}
          tone="destructive"
        />
      </SectionCard>

      <SectionLabel>Preferences</SectionLabel>
      <SectionCard>
        <SettingRow
          icon={Sparkles}
          iconAccent
          label="Reintroduce me to Membr"
          onClick={resetOnboarding}
        />
        <SettingRow
          icon={Bell}
          label="Notifications"
          onClick={() => setNotifPrefsOpen(true)}
        />
        <SettingRow
          icon={ShieldCheck}
          label="App Permissions"
          onClick={() => setPermsOpen(true)}
        />
      </SectionCard>

      <SectionLabel>People</SectionLabel>
      <SectionCard>
        {onOpenImport && (
          <SettingRow
            icon={Upload}
            label="Smart Import"
            onClick={onOpenImport}
          />
        )}
        <SettingRow
          icon={Sparkles}
          iconAccent
          label="AI Enrichment"
          rightLabel="Soon"
          info
          onClick={() => setEnrichInfoOpen(true)}
        />
      </SectionCard>

      <SectionLabel>About</SectionLabel>
      <SectionCard>
        <AIDisclosure />
        <SettingRow
          label="Version"
          rightLabel={APP_VERSION}
          nonInteractive
        />
        {PRIVACY_POLICY_URL && (
          <SettingRow
            label="Privacy Policy"
            onClick={() => window.open(PRIVACY_POLICY_URL!, '_blank', 'noopener,noreferrer')}
          />
        )}
      </SectionCard>

      <div className="px-5 mt-2">
        <button
          onClick={() => setDeleteConfirmOpen(true)}
          disabled={deleting}
          className="text-[13px] font-display-italic text-[hsl(var(--foreground)/0.5)] disabled:opacity-50"
        >
          {deleting ? 'Deleting…' : 'Delete account'}
        </button>
      </div>

      <EnrichInfoModal open={enrichInfoOpen} onClose={() => setEnrichInfoOpen(false)} />

      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Delete your account?"
        description="This permanently removes your account, all the people you've added, your circles and events, encounters, and any photos. This cannot be undone."
        confirmLabel="Delete account"
        cancelLabel="Keep account"
        destructive
        loading={deleting}
        loadingLabel="Deleting"
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setDeleteConfirmOpen(false)}
      />

      <AnimatePresence>
        {notifPrefsOpen && (
          <NotificationPreferencesPage onBack={() => setNotifPrefsOpen(false)} />
        )}
        {permsOpen && (
          <AppPermissionsPage onBack={() => setPermsOpen(false)} />
        )}
      </AnimatePresence>

      {settingsOpen && (
        <>
          <div
            className="fixed inset-0 z-[60] bg-black/60 animate-fade-in"
            onClick={() => setSettingsOpen(null)}
          />
          <div
            className="kb-aware-sheet glass-sheet fixed left-0 right-0 mx-auto w-full max-w-md rounded-t-2xl overflow-y-auto safe-bottom z-[60] animate-scale-in flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b border-[hsl(0_0%_100%/0.08)]" style={{ background: 'rgba(20, 14, 14, 0.92)' }}>
              <h2 className="text-xl font-display text-foreground tracking-[-0.02em]">
                {settingsOpen === 'email'
                  ? 'Change email'
                  : settingsOpen === 'name'
                  ? 'Your name'
                  : 'Change password'}
              </h2>
              <button
                onClick={() => setSettingsOpen(null)}
                aria-label="Close"
                className="w-8 h-8 rounded-md flex items-center justify-center text-[hsl(var(--foreground)/0.55)]"
              >
                <X className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>

            <div className="p-5">
              {settingsOpen === 'name' ? (
                <form onSubmit={handleNameUpdate} className="space-y-3">
                  <p className="text-[12px] text-[hsl(var(--foreground)/0.6)]">
                    Used in your home greeting. First name only.
                  </p>
                  <input
                    type="text"
                    placeholder="First name"
                    value={newFirstName}
                    onChange={(e) => setNewFirstName(e.target.value)}
                    autoCapitalize="words"
                    autoCorrect="off"
                    autoComplete="given-name"
                    maxLength={40}
                    autoFocus
                    className="glass-input w-full h-11 px-3.5 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={nameLoading || !newFirstName.trim() || newFirstName.trim() === currentFirstName}
                    className="w-full h-[52px] rounded-2xl bg-primary text-primary-foreground font-semibold text-[15px] disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                  >
                    {nameLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                    Save name
                  </button>
                </form>
              ) : settingsOpen === 'email' ? (
                <form onSubmit={handleEmailUpdate} className="space-y-3">
                  <p className="text-[12px] text-[hsl(var(--foreground)/0.6)]">
                    Current: <span className="text-foreground">{user?.email}</span>. You'll get a confirmation link at both addresses.
                  </p>
                  <input
                    type="email"
                    placeholder="New email address"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="glass-input w-full h-11 px-3.5 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={emailLoading || !newEmail}
                    className="w-full h-[52px] rounded-2xl bg-primary text-primary-foreground font-semibold text-[15px] disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                  >
                    {emailLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                    Update email
                  </button>
                </form>
              ) : (
                <form onSubmit={handlePasswordUpdate} className="space-y-3">
                  <p className="text-[12px] text-[hsl(var(--foreground)/0.6)]">Use at least 6 characters.</p>
                  <input
                    type="password"
                    placeholder="New password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    minLength={6}
                    className="glass-input w-full h-11 px-3.5 text-sm"
                  />
                  <input
                    type="password"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    minLength={6}
                    className="glass-input w-full h-11 px-3.5 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={pwLoading || !newPassword}
                    className="w-full h-[52px] rounded-2xl bg-primary text-primary-foreground font-semibold text-[15px] disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                  >
                    {pwLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                    Update password
                  </button>
                </form>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-5 mb-2 mt-1">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[hsl(var(--foreground)/0.55)]">
        {children}
      </h2>
    </div>
  );
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-5 mb-5">
      <div className="glass overflow-hidden p-0">
        {children}
      </div>
    </div>
  );
}

function SettingRow({
  icon: Icon,
  iconAccent,
  label,
  rightLabel,
  onClick,
  tone,
  nonInteractive,
  info,
}: {
  icon?: ComponentType<{ className?: string; strokeWidth?: number }>;
  iconAccent?: boolean;
  label: string;
  rightLabel?: string;
  onClick?: () => void;
  tone?: 'default' | 'destructive';
  nonInteractive?: boolean;
  info?: boolean;
}) {
  const isDestructive = tone === 'destructive';
  const cls = cn(
    'glass-row w-full text-left',
    isDestructive && 'destructive',
  );
  const Inner = (
    <>
      {Icon && (
        <Icon
          className={cn(
            'w-4 h-4 shrink-0',
            isDestructive
              ? 'text-primary'
              : iconAccent
                ? 'text-primary'
                : 'text-[hsl(var(--foreground)/0.55)]',
          )}
          strokeWidth={1.75}
        />
      )}
      <span className="text-[15px] flex-1 truncate">{label}</span>
      {rightLabel ? (
        <span className="text-[12px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[hsl(0_0%_100%/0.08)] text-[hsl(var(--foreground)/0.6)]">
          {rightLabel}
        </span>
      ) : null}
      {info ? (
        <Info className="w-3.5 h-3.5 text-[hsl(var(--foreground)/0.45)] shrink-0 ml-1" strokeWidth={1.75} />
      ) : !rightLabel && !nonInteractive ? (
        <ChevronRight className="w-4 h-4 text-[hsl(var(--foreground)/0.45)] shrink-0" strokeWidth={1.75} />
      ) : null}
    </>
  );

  if (nonInteractive) {
    return <div className={cls}>{Inner}</div>;
  }
  return (
    <button onClick={onClick} className={cls}>
      {Inner}
    </button>
  );
}
