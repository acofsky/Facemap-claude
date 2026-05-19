import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Camera, Image as ImageIcon, BookUser, Bell, ChevronRight } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Contacts } from '@capacitor-community/contacts';
import { LocalNotifications } from '@capacitor/local-notifications';
import { cn } from '@/lib/utils';
import { useSwipeBack } from '@/hooks/use-swipe-back';

interface AppPermissionsPageProps {
  onBack: () => void;
}

type PermissionState = 'granted' | 'denied' | 'prompt' | 'managed' | 'unknown';

interface Row {
  key: 'camera' | 'photos' | 'contacts' | 'notifications';
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  state: PermissionState;
}

const STATE_LABEL: Record<PermissionState, string> = {
  granted: 'Allowed',
  denied: 'Not allowed',
  prompt: 'Not requested',
  managed: 'Managed by iOS',
  unknown: '—',
};

/**
 * PROFILE-03 — App Permissions. iOS apps can't re-prompt for denied
 * permissions; this screen shows current status and deep-links to
 * Settings → Membr so the user can flip them there.
 */
export function AppPermissionsPage({ onBack }: AppPermissionsPageProps) {
  const [contacts, setContacts] = useState<PermissionState>('unknown');
  const [notifications, setNotifications] = useState<PermissionState>('unknown');
  const swipe = useSwipeBack(onBack);

  const isNative = Capacitor.isNativePlatform();

  // Camera + Photo Library: the app uses iOS's native file picker, which
  // owns those permissions implicitly. We can't query them — surface as
  // "Managed by iOS" so users know to flip them in Settings.
  const camera: PermissionState = isNative ? 'managed' : 'unknown';
  const photos: PermissionState = isNative ? 'managed' : 'unknown';

  useEffect(() => {
    if (!isNative) return;
    (async () => {
      try {
        const c = await Contacts.checkPermissions();
        setContacts(coerce(c.contacts));
      } catch { /* contacts plugin not available — left as 'unknown' */ }
      try {
        const n = await LocalNotifications.checkPermissions();
        setNotifications(coerce(n.display));
      } catch { /* same */ }
    })();
  }, [isNative]);

  const openSettings = () => {
    if (!isNative) return;
    // @capacitor/app v7 dropped `openUrl`; the Capacitor iOS WKWebView
    // delegates unrecognised URL schemes (app-settings:, mailto:, etc.) to
    // UIApplication, which is exactly what we want here. Navigating the
    // top window is the simplest cross-version trigger.
    window.location.href = 'app-settings:';
  };

  const rows: Row[] = [
    { key: 'camera', label: 'Camera', description: 'Take photos when adding people.', icon: Camera, state: camera },
    { key: 'photos', label: 'Photo Library', description: 'Attach existing photos to people.', icon: ImageIcon, state: photos },
    { key: 'contacts', label: 'Contacts', description: 'Link Membr people to iPhone contacts.', icon: BookUser, state: contacts },
    { key: 'notifications', label: 'Notifications', description: "Send the End-of-Day reminder.", icon: Bell, state: notifications },
  ];

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
          // `none` (not `pan-y`): keeps the swipe's vertical component from
          // leaking into a scroll on the page underneath. The inner scroll
          // area re-enables vertical panning for itself.
          touchAction: 'none',
        }}
        {...swipe.bind}
      >
      <div className="bg-background flex items-center justify-between px-3 pt-3 pb-2 border-b border-[hsl(0_0%_100%/0.06)]">
        <button onClick={onBack} aria-label="Back" className="w-10 h-10 -ml-1 flex items-center justify-center text-foreground active:scale-95 transition-transform">
          <ArrowLeft className="w-5 h-5" strokeWidth={1.75} />
        </button>
        <h1 className="font-sans text-[17px] font-semibold text-foreground">App Permissions</h1>
        <span className="w-10" />
      </div>

      <div className="overflow-y-auto scrollbar-hide touch-pan-y flex-1 px-5 pt-4 pb-10">
        <p className="text-[13px] text-muted-text leading-relaxed mb-5">
          iOS doesn't let apps re-prompt for permissions once you've decided. To change anything below, tap "Change in Settings" — it'll open iOS Settings → Membr.
        </p>

        <div className="rounded-lg bg-surface-1 border border-[hsl(0_0%_100%/0.08)] overflow-hidden divide-y divide-[hsl(0_0%_100%/0.06)]">
          {rows.map((r) => (
            <div key={r.key} className="px-4 py-3.5 flex items-start gap-3">
              <r.icon className="w-4 h-4 text-muted-text mt-0.5 shrink-0" strokeWidth={1.75} />
              <div className="flex-1 min-w-0">
                <div className="text-[15px] text-foreground">{r.label}</div>
                <div className="text-[12px] text-muted-text leading-snug mt-0.5">{r.description}</div>
                <div className="text-[11px] mt-1.5">
                  <span className={cn(
                    r.state === 'granted' ? 'text-success'
                    : r.state === 'denied' ? 'text-destructive'
                    : 'text-muted-text',
                  )}>
                    {STATE_LABEL[r.state]}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={openSettings}
          disabled={!isNative}
          className="mt-4 w-full h-11 rounded-md bg-surface-2 border border-[hsl(0_0%_100%/0.12)] text-foreground text-sm font-medium hover:border-[hsl(0_0%_100%/0.18)] transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-50"
        >
          Change in Settings <ChevronRight className="w-4 h-4" strokeWidth={1.75} />
        </button>
        {!isNative && (
          <p className="mt-2 text-[12px] text-muted-text italic text-center">
            The deep link works only on the iPhone build.
          </p>
        )}
      </div>
      </div>
    </motion.div>
  );
}

function coerce(s: string | undefined): PermissionState {
  if (s === 'granted') return 'granted';
  if (s === 'denied') return 'denied';
  if (s === 'prompt' || s === 'prompt-with-rationale' || s === 'limited') return 'prompt';
  return 'unknown';
}
