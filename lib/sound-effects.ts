'use client';

let sharedAudioCtx: AudioContext | null = null;
let audioUnlocked = false;
let lastChimeAtMs = 0;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
    sharedAudioCtx = new Ctor();
  }
  return sharedAudioCtx;
}

/**
 * Unlocks Web Audio on the first user gesture so incoming SMS/chat bell chimes
 * play reliably without browser autoplay blocks.
 */
export function registerNotificationAudioUnlock(): () => void {
  if (typeof window === 'undefined') return () => {};
  const unlock = () => {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      void ctx.resume().then(() => {
        audioUnlocked = true;
      }).catch(() => {});
    } else {
      audioUnlocked = true;
    }
  };
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock, { passive: true });
  return () => {
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
}

/**
 * Plays a crisp, bright two-tone LinkedIn-style notification bell chime
 * (B5 -> E6 with soft shimmer harmonic) when a user receives an incoming message.
 */
export function playLinkedInBellChime(): void {
  const nowMs = Date.now();
  if (nowMs - lastChimeAtMs < 800) return;
  lastChimeAtMs = nowMs;

  const ctx = getAudioContext();
  if (!ctx) return;

  const triggerNotes = () => {
    try {
      const t0 = ctx.currentTime + 0.01;
      const playTone = (
        freq: number,
        start: number,
        duration: number,
        peakGain: number
      ) => {
        const osc = ctx.createOscillator();
        const overtone = ctx.createOscillator();
        const gain = ctx.createGain();
        const overtoneGain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);

        overtone.type = 'triangle';
        overtone.frequency.setValueAtTime(freq * 2, start);

        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(peakGain, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

        overtoneGain.gain.setValueAtTime(0.0001, start);
        overtoneGain.gain.exponentialRampToValueAtTime(peakGain * 0.22, start + 0.012);
        overtoneGain.gain.exponentialRampToValueAtTime(0.0001, start + duration * 0.75);

        osc.connect(gain);
        overtone.connect(overtoneGain);
        overtoneGain.connect(gain);
        gain.connect(ctx.destination);

        osc.start(start);
        overtone.start(start);
        osc.stop(start + duration + 0.02);
        overtone.stop(start + duration + 0.02);
      };

      // Signature LinkedIn-like bright double-bell chime (B5 -> E6)
      playTone(987.77, t0, 0.24, 0.18);
      playTone(1318.51, t0 + 0.11, 0.42, 0.22);
    } catch {
      // Ignore blocked audio contexts silently
    }
  };

  if (ctx.state === 'suspended') {
    if (!audioUnlocked) {
      void ctx.resume().then(triggerNotes).catch(() => {});
    } else {
      void ctx.resume().then(triggerNotes).catch(() => {});
    }
    return;
  }

  triggerNotes();
}
