import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { LogOut, Mail, Lock, ChevronRight, X, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type SettingsView = null | 'email' | 'password';

export function ProfilePage() {
  const { user, signOut } = useAuth();

  const [openView, setOpenView] = useState<SettingsView>(null);
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
      setOpenView(null);
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
      setOpenView(null);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setPwLoading(false);
    }
  };

  const initial = (user?.email || '?').charAt(0).toUpperCase();

  return (
    <div className="px-5 pt-12 pb-8 animate-fade-in">
      <div className="mb-6 pr-14">
        <h1 className="font-display text-foreground leading-none" style={{ fontSize: '36px' }}>Profile</h1>
      </div>

      {/* User card */}
      <div className="surface-card p-5 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-secondary border border-border flex items-center justify-center">
            <span className="font-display text-foreground" style={{ fontSize: '22px' }}>{initial}</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-medium text-foreground truncate">
              {user?.email || 'You'}
            </div>
            <div className="text-[13px] text-muted-foreground mt-0.5">
              Joined {user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Settings menu list */}
      <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-2 px-1">Account</p>
      <div className="surface-card overflow-hidden mb-8">
        <button
          onClick={() => setOpenView('email')}
          className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-foreground/[0.03] transition-colors border-b border-border"
        >
          <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" strokeWidth={1.75} />
          <span className="flex-1 text-left text-[15px] text-foreground">Email</span>
          <ChevronRight className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} />
        </button>
        <button
          onClick={() => setOpenView('password')}
          className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-foreground/[0.03] transition-colors"
        >
          <Lock className="w-4 h-4 text-muted-foreground flex-shrink-0" strokeWidth={1.75} />
          <span className="flex-1 text-left text-[15px] text-foreground">Password</span>
          <ChevronRight className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} />
        </button>
      </div>

      {/* Sign out */}
      <button
        onClick={signOut}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-button bg-secondary border border-border text-destructive hover:border-destructive/40 transition-colors text-[15px] font-medium"
      >
        <LogOut className="w-4 h-4" strokeWidth={1.75} />
        Sign out
      </button>

      {/* Settings bottom sheet */}
      {openView !== null && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 animate-fade-in"
          onClick={() => setOpenView(null)}
        >
          <div
            className="w-full sm:max-w-md bg-secondary border-t sm:border border-border rounded-t-sheet-top sm:rounded-modal max-h-[90vh] overflow-y-auto animate-slide-up sm:animate-scale-in"
            onClick={e => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-secondary flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="font-display text-foreground" style={{ fontSize: '22px' }}>
                {openView === 'email' ? 'Change email' : 'Change password'}
              </h2>
              <button
                onClick={() => setOpenView(null)}
                aria-label="Close"
                className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center"
              >
                <X className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} />
              </button>
            </div>

            <div className="p-5">
              {openView === 'email' && (
                <form onSubmit={handleEmailUpdate} className="space-y-3">
                  <p className="text-[13px] text-muted-foreground">
                    Current: <span className="text-foreground">{user?.email}</span>. You'll get a confirmation link at both addresses.
                  </p>
                  <input
                    type="email"
                    placeholder="New email address"
                    value={newEmail}
                    onChange={e => setNewEmail(e.target.value)}
                    className="w-full px-4 py-3 rounded-input bg-card border border-border text-[15px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/15 transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={emailLoading || !newEmail}
                    className="w-full py-2.5 rounded-button bg-primary text-primary-foreground text-[15px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {emailLoading && <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.75} />}
                    Update email
                  </button>
                </form>
              )}

              {openView === 'password' && (
                <form onSubmit={handlePasswordUpdate} className="space-y-3">
                  <p className="text-[13px] text-muted-foreground">Use at least 6 characters.</p>
                  <input
                    type="password"
                    placeholder="New password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    minLength={6}
                    className="w-full px-4 py-3 rounded-input bg-card border border-border text-[15px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/15 transition-colors"
                  />
                  <input
                    type="password"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    minLength={6}
                    className="w-full px-4 py-3 rounded-input bg-card border border-border text-[15px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/15 transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={pwLoading || !newPassword}
                    className="w-full py-2.5 rounded-button bg-primary text-primary-foreground text-[15px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {pwLoading && <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.75} />}
                    Update password
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
