import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { usePersons, useCircles } from '@/hooks/use-data';
import { User, Users, CircleDot, LogOut, Settings, X, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AIDisclosure } from '@/components/AIDisclosure';

export function ProfilePage() {
  const { user, signOut } = useAuth();
  const { data: people = [] } = usePersons();
  const { data: circles = [] } = useCircles();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  const handleEmailUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || newEmail === user?.email) return;
    setEmailLoading(true);
    try {
      const { error } = await supabase.auth.updateUser(
        { email: newEmail },
        { emailRedirectTo: `${window.location.origin}/` }
      );
      if (error) throw error;
      toast.success('Check both your old and new email to confirm the change.');
      setNewEmail('');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setEmailLoading(false);
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
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <div className="px-5 pt-12 pb-8 animate-fade-in">
      <div className="mb-8 pr-14">
        <h1 className="text-3xl font-display text-foreground">Profile</h1>
      </div>

      {/* User card */}
      <div className="rounded-xl bg-card warm-shadow p-5 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="w-6 h-6 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-medium text-foreground truncate">
              {user?.email || 'You'}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Joined {user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—'}
            </div>
          </div>
          <button
            onClick={() => setSettingsOpen(true)}
            className="w-9 h-9 rounded-full bg-secondary/60 flex items-center justify-center hover:bg-secondary transition-colors shrink-0"
            aria-label="Account settings"
          >
            <Settings className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-8">
        <div className="rounded-xl bg-card warm-shadow p-4 text-center">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div className="text-2xl font-display text-foreground">{people.length}</div>
          <div className="text-xs text-muted-foreground">People</div>
        </div>
        <div className="rounded-xl bg-card warm-shadow p-4 text-center">
          <div className="w-10 h-10 rounded-full bg-accent/30 flex items-center justify-center mx-auto mb-2">
            <CircleDot className="w-5 h-5 text-accent-foreground" />
          </div>
          <div className="text-2xl font-display text-foreground">{circles.length}</div>
          <div className="text-xs text-muted-foreground">Circles</div>
        </div>
      </div>

      {/* AI disclosure — Apple Review Guideline 2.5.18 */}
      <div className="mb-3">
        <AIDisclosure />
      </div>

      {/* Sign out */}
      <button
        onClick={signOut}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-card border border-border text-foreground hover:bg-secondary/60 transition-colors warm-shadow text-sm font-medium"
      >
        <LogOut className="w-4 h-4" />
        Sign out
      </button>

      {/* Settings sheet */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 animate-fade-in" onClick={() => setSettingsOpen(false)}>
          <div
            className="w-full sm:max-w-md bg-background border-t sm:border border-border rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-background flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-xl font-display text-foreground">Account settings</h2>
              <button onClick={() => setSettingsOpen(false)} className="w-8 h-8 rounded-full hover:bg-secondary/60 flex items-center justify-center">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            <div className="p-5 space-y-8">
              {/* Change email */}
              <form onSubmit={handleEmailUpdate} className="space-y-3">
                <div>
                  <h3 className="text-sm font-medium text-foreground">Change email</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Current: <span className="text-foreground">{user?.email}</span>. You'll get a confirmation link at both addresses.
                  </p>
                </div>
                <input
                  type="email"
                  placeholder="New email address"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
                />
                <button
                  type="submit"
                  disabled={emailLoading || !newEmail}
                  className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                >
                  {emailLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Update email
                </button>
              </form>

              <div className="border-t border-border" />

              {/* Change password */}
              <form onSubmit={handlePasswordUpdate} className="space-y-3">
                <div>
                  <h3 className="text-sm font-medium text-foreground">Change password</h3>
                  <p className="text-xs text-muted-foreground mt-1">Use at least 6 characters.</p>
                </div>
                <input
                  type="password"
                  placeholder="New password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  minLength={6}
                  className="w-full px-4 py-3 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
                />
                <input
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  minLength={6}
                  className="w-full px-4 py-3 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
                />
                <button
                  type="submit"
                  disabled={pwLoading || !newPassword}
                  className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                >
                  {pwLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Update password
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
