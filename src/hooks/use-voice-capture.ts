import { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor, PluginListenerHandle } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import { haptics } from '@/lib/haptics';

type VoiceCaptureState = 'idle' | 'recording' | 'denied' | 'unsupported';

export interface StartResult {
  ok: boolean;
  error?: string;
}

interface UseVoiceCaptureResult {
  state: VoiceCaptureState;
  transcript: string;
  partial: string;
  error: string | null;
  start: () => Promise<StartResult>;
  stop: () => Promise<void>;
  reset: () => void;
}

/**
 * Wraps @capacitor-community/speech-recognition with the surface the
 * VoiceAddSheet wants: a single committed transcript plus a rolling
 * partial chunk that's updated live while the user speaks. Recognition
 * is native iOS SFSpeechRecognizer; on the web fallback we expose
 * `unsupported` so the UI can show a "device only" message rather than
 * silently doing nothing.
 *
 * start() returns { ok } so callers can wait for the native session to
 * actually be running before they switch their UI into a recording
 * state — flipping UI before the plugin confirms produces a flash if the
 * session can't begin (e.g. mic busy, prior session still tearing down).
 */
export function useVoiceCapture(): UseVoiceCaptureResult {
  const [state, setState] = useState<VoiceCaptureState>('idle');
  const [transcript, setTranscript] = useState('');
  const [partial, setPartial] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Keep the in-flight partial in a ref so the partial-results listener
  // can promote it to `transcript` on stop without racing React state.
  const partialRef = useRef('');
  const listenersAttachedRef = useRef(false);

  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    return () => {
      if (isNative) {
        SpeechRecognition.stop().catch(() => {});
        SpeechRecognition.removeAllListeners().catch(() => {});
      }
      listenersAttachedRef.current = false;
    };
  }, [isNative]);

  const reset = useCallback(() => {
    setTranscript('');
    setPartial('');
    partialRef.current = '';
    setError(null);
  }, []);

  const ensureCleanSession = async () => {
    // The plugin throws "Ongoing speech recognition" if audioEngine.isRunning
    // is true when start() is called. That happens when a previous session
    // didn't tear down cleanly (sheet closed mid-record, silence auto-stop
    // that didn't release the audio session, etc.). Belt-and-braces: query
    // isListening, stop if needed, clear all listeners, and give iOS a
    // beat to release the audio session.
    try {
      const { listening } = await SpeechRecognition.isListening();
      if (listening) {
        await SpeechRecognition.stop();
      }
    } catch {
      // best-effort
    }
    try {
      await SpeechRecognition.removeAllListeners();
    } catch {
      // best-effort
    }
    listenersAttachedRef.current = false;
    await new Promise((r) => setTimeout(r, 60));
  };

  const attachListeners = async () => {
    const partialHandle: PluginListenerHandle = await SpeechRecognition.addListener(
      'partialResults',
      (data: { matches?: string[] }) => {
        const best = data?.matches?.[0] ?? '';
        partialRef.current = best;
        setPartial(best);
      },
    );
    const stateHandle: PluginListenerHandle = await SpeechRecognition.addListener(
      'listeningState',
      (data: { status: 'started' | 'stopped' }) => {
        if (data.status === 'stopped') {
          // Snapshot the partial *before* we queue any state updates. The
          // setTranscript updater runs asynchronously during React's commit
          // phase, by which point partialRef.current may already have been
          // reset below — losing the final spoken text.
          const finalPartial = partialRef.current;
          partialRef.current = '';
          setTranscript((prev) => {
            const joined = [prev, finalPartial].filter(Boolean).join(' ').trim();
            return joined;
          });
          setPartial('');
          setState('idle');
        }
      },
    );
    // Hold references so subsequent removeAllListeners() can clear them;
    // we keep handles alive via the plugin's internal registry.
    void partialHandle;
    void stateHandle;
    listenersAttachedRef.current = true;
  };

  const friendlyStartError = (raw: string): string => {
    const lower = raw.toLowerCase();
    if (lower.includes('ongoing')) {
      return "Membr is still finishing the previous take. Wait a second and tap again.";
    }
    if (lower.includes('permission') || lower.includes('denied') || lower.includes('not authorized')) {
      return 'Membr needs microphone and speech permissions. Enable them in Settings.';
    }
    if (lower.includes('audio') || lower.includes('engine')) {
      return "Couldn't access the microphone. Close other apps using it and try again.";
    }
    return "Couldn't start listening. Try again.";
  };

  const start = useCallback(async (): Promise<StartResult> => {
    setError(null);
    if (!isNative) {
      setState('unsupported');
      const msg = 'Voice add only works on the iOS app.';
      setError(msg);
      return { ok: false, error: msg };
    }

    try {
      const { available } = await SpeechRecognition.available();
      if (!available) {
        setState('unsupported');
        const msg = "This device doesn't support speech recognition.";
        setError(msg);
        return { ok: false, error: msg };
      }

      const perm = await SpeechRecognition.checkPermissions();
      if (perm.speechRecognition !== 'granted') {
        const req = await SpeechRecognition.requestPermissions();
        if (req.speechRecognition !== 'granted') {
          setState('denied');
          const msg = 'Membr needs microphone and speech permissions to listen. Enable them in Settings.';
          setError(msg);
          return { ok: false, error: msg };
        }
      }

      await ensureCleanSession();
      await attachListeners();

      await SpeechRecognition.start({
        language: 'en-US',
        partialResults: true,
        popup: false,
      });

      haptics.light();
      setState('recording');
      return { ok: true };
    } catch (e) {
      console.error('Voice capture start failed', e);
      const raw = e instanceof Error ? e.message : String(e);
      const msg = friendlyStartError(raw);
      setError(msg);
      setState('idle');
      // Tear down any partially-attached listeners.
      try { await SpeechRecognition.removeAllListeners(); } catch { /* ignore */ }
      listenersAttachedRef.current = false;
      return { ok: false, error: msg };
    }
  }, [isNative]);

  const stop = useCallback(async () => {
    if (!isNative) return;
    try {
      haptics.medium();
      await SpeechRecognition.stop();
      // listeningState 'stopped' handler will promote partial → transcript.
    } catch (e) {
      console.error('Voice capture stop failed', e);
      setState('idle');
    }
  }, [isNative]);

  return { state, transcript, partial, error, start, stop, reset };
}
