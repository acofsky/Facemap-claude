import { useState, type ComponentType } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/use-auth';
import { LogOut, X, Loader2, Bell, ShieldCheck, ChevronRight, AtSign, KeyRound, Pencil, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AIDisclosure } from '@/components/AIDisclosure';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { NotificationPreferencesPage } from '@/pages/NotificationPreferencesPage';
import { AppPermissionsPage } from '@/pages/AppPermissionsPage';
import { cn } from '@/lib/utils';
import { useOnboarded } from '@/hooks/use-onboarded';

const APP_VERSION = '1.0.0';
// TODO when the policy is hosted, replace with the live URL.
const PRIVACY_POLICY_URL: string | null = null;

export function ProfilePage() {
  const { user, signOut } = useAuth();
  const { resetOnboarding } = useOnboarded();
  const [settingsOpen, setSettingsOpen] = useState<null | 'email' | 'password' | 'name'>(null);
  const [notifPrefsOpen, setNotifPrefsOpen] = useState(false);
  const [permsOpen, setPermsOpen] = useState(false);
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
    } catch (err: any) {
      toast.error(err.message);
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
    } catch (err: any) {
      toast.error(err.message);
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
    } catch (err: any) {
      toast.error(err.message);
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
      // Wipes the user's owned rows in every table + the photo folder in
      // storage + auth.users itself. Lives in supabase/functions/delete-account.
      // Required for App Store Guideline 5.1.1(v).
      const { error } = await supabase.functions.invoke('delete-account');
      if (error) throw error;
      // Drop the local session — onAuthStateChange will bounce us back
      // to AuthPage now that the JWT is invalid.
      await signOut();
      toast.success('Account deleted.');
    } catch (err: any) {
      toast.error(err?.message || 'Could not delete account. Try again.');
      setDeleting(false);
      setDeleteConfirmOpen(false);
    }
  };

  const displayName =
    currentFirstName ||
    ((user?.user_metadata as any)?.full_name as string | undefined) ||
    '';
  const initials = (displayName[0] || user?.email?.[0] || '?').toUpperCase();

  return (
    <div className="pb-10 animate-fade-in">
      {/* Nav bar */}
      <div className="sticky top-0 z-20 bg-background flex items-center justify-center pt-3 pb-3 mb-1">
        <h1 className="text-[17px] font-semibold text-foreground">Profile</h1>
      </div>

      {/* User block */}
      <div className="px-5 mb-7 flex items-center gap-3.5">
        <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold text-base">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          {displayName && (
            <div className="text-[16px] font-semibold text-foreground truncate">{displayName}</div>
          )}
          <div className={cn('truncate', displayName ? 'text-[13px] text-muted-text' : 'text-[15px] font-medium text-foreground')}>
            {user?.email}
          </div>
        </div>
      </div>

      {/* Account */}
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
          last
        />
      </SectionCard>

      {/* Preferences */}
      <SectionLabel>Preferences</SectionLabel>
      <SectionCard>
        <SettingRow
          icon={Sparkles}
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
          last
        />
      </SectionCard>

      {/* About */}
      <SectionLabel>About</SectionLabel>
      <div className="px-5 mb-3">
        <AIDisclosure />
      </div>
      <SectionCard>
        <SettingRow
          label="Version"
          rightLabel={APP_VERSION}
          nonInteractive
        />
        {/* Terms-of-Service row removed: Apple doesn't require ToS and we
            don't have one. Privacy Policy stays, opens the live URL once
            it's set — until then the row is hidden so the App Store
            reviewer doesn't tap a dead link. */}
        {PRIVACY_POLICY_URL && (
          <SettingRow
            label="Privacy Policy"
            onClick={() => window.open(PRIVACY_POLICY_URL!, '_blank', 'noopener,noreferrer')}
            last
          />
        )}
      </SectionCard>

      <div className="px-5 mt-2">
        <button
          onClick={() => setDeleteConfirmOpen(true)}
          disabled={deleting}
          className="text-[14px] text-muted-text hover:text-destructive transition-colors disabled:opacity-50"
        >
          {deleting ? 'Deleting…' : 'Delete Account'}
        </button>
      </div>

      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Delete your account?"
        description="This permanently removes your account, all the people you've added, your circles and events, encounters, and any photos. This cannot be undone."
        confirmLabel={deleting ? 'Deleting…' : 'Delete account'}
        cancelLabel="Keep account"
        destructive
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setDeleteConfirmOpen(false)}
      />

      {/* Settings inline sheet */}
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
            className="kb-aware-sheet fixed left-0 right-0 mx-auto w-full max-w-md bg-surface-2 border-t border-[hsl(0_0%_100%/0.12)] rounded-t-2xl overflow-y-auto safe-bottom z-[60] animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-surface-2 flex items-center justify-between px-5 py-4 border-b border-[hsl(0_0%_100%/0.08)]">
              <h2 className="text-xl font-display text-foreground tracking-[-0.02em]">
                {settingsOpen === 'email'
                  ? 'Change email'
                  : settingsOpen === 'name'
                  ? 'Your name'
                  : 'Change password'}
              </h2>
              <button onClick={() => setSettingsOpen(null)} aria-label="Close" className="w-8 h-8 rounded-md hover:bg-[hsl(0_0%_100%/0.06)] flex items-center justify-center">
                <X className="w-4 h-4 text-muted-text" strokeWidth={1.75} />
              </button>
            </div>

            <div className="p-5">
              {settingsOpen === 'name' ? (
                <form onSubmit={handleNameUpdate} className="space-y-3">
                  <p className="text-[12px] text-muted-text">
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
                    className="w-full h-11 px-3.5 rounded-md bg-surface-2 border border-[hsl(0_0%_100%/0.08)] text-sm text-foreground placeholder:text-muted-text focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/15"
                  />
                  <button
                    type="submit"
                    disabled={nameLoading || !newFirstName.trim() || newFirstName.trim() === currentFirstName}
                    className="w-full h-[52px] rounded-md bg-primary text-primary-foreground font-semibold text-[15px] disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                  >
                    {nameLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                    Save name
                  </button>
                </form>
              ) : settingsOpen === 'email' ? (
                <form onSubmit={handleEmailUpdate} className="space-y-3">
                  <p className="text-[12px] text-muted-text">
                    Current: <span className="text-foreground">{user?.email}</span>. You'll get a confirmation link at both addresses.
                  </p>
                  <input
                    type="email"
                    placeholder="New email address"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-md bg-surface-2 border border-[hsl(0_0%_100%/0.08)] text-sm text-foreground placeholder:text-muted-text focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/15"
                  />
                  <button
                    type="submit"
                    disabled={emailLoading || !newEmail}
                    className="w-full h-[52px] rounded-md bg-primary text-primary-foreground font-semibold text-[15px] disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                  >
                    {emailLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                    Update email
                  </button>
                </form>
              ) : (
                <form onSubmit={handlePasswordUpdate} className="space-y-3">
                  <p className="text-[12px] text-muted-text">Use at least 6 characters.</p>
                  <input
                    type="password"
                    placeholder="New password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    minLength={6}
                    className="w-full h-11 px-3.5 rounded-md bg-surface-2 border border-[hsl(0_0%_100%/0.08)] text-sm text-foreground placeholder:text-muted-text focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/15"
                  />
                  <input
                    type="password"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    minLength={6}
                    className="w-full h-11 px-3.5 rounded-md bg-surface-2 border border-[hsl(0_0%_100%/0.08)] text-sm text-foreground placeholder:text-muted-text focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/15"
                  />
                  <button
                    type="submit"
                    disabled={pwLoading || !newPassword}
                    className="w-full h-[52px] rounded-md bg-primary text-primary-foreground font-semibold text-[15px] disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
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
      <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-text">{children}</h2>
    </div>
  );
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-5 mb-5">
      <div className="rounded-lg bg-surface-1 border border-[hsl(0_0%_100%/0.08)] overflow-hidden divide-y divide-[hsl(0_0%_100%/0.06)]">
        {children}
      </div>
    </div>
  );
}

function SettingRow({
  icon: Icon,
  label,
  rightLabel,
  onClick,
  tone,
  nonInteractive,
  last,
}: {
  icon?: ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  rightLabel?: string;
  onClick?: () => void;
  tone?: 'default' | 'destructive';
  nonInteractive?: boolean;
  last?: boolean;
}) {
  const cls = cn(
    'w-full h-[52px] flex items-center gap-3 px-4 text-left',
    !nonInteractive && 'hover:bg-[hsl(0_0%_100%/0.04)] active:bg-[hsl(0_0%_100%/0.06)]',
    tone === 'destructive' ? 'text-primary' : 'text-foreground',
  );
  const Inner = (
    <>
      {Icon && (
        <Icon
          className={cn('w-4 h-4 shrink-0', tone === 'destructive' ? 'text-primary' : 'text-muted-text')}
          strokeWidth={1.75}
        />
      )}
      <span className="text-[15px] flex-1 truncate">{label}</span>
      {rightLabel ? (
        <span className="text-[13px] text-muted-text">{rightLabel}</span>
      ) : !nonInteractive ? (
        <ChevronRight className="w-4 h-4 text-muted-text shrink-0" strokeWidth={1.75} />
      ) : null}
    </>
  );

  if (nonInteractive) {
    return <div className={cls + (last ? '' : '')}>{Inner}</div>;
  }
  return (
    <button onClick={onClick} className={cls}>
      {Inner}
    </button>
  );
}
