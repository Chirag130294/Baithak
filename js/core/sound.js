// Sound effects made with the browser's built-in synthesizer (Web Audio). No audio files, so nothing to download.
// Quiet by design, off with one switch in Customize, and nothing plays until the person has tapped the screen once.
import { pref } from './prefs.js';

let ctx = null, master = null;
function ac() {
  if (ctx) return ctx;
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AC) return null;
  try { ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.22; master.connect(ctx.destination); } catch { ctx = null; }
  return ctx;
}
if (typeof document !== 'undefined') {
  const wake = () => { const c = ac(); if (c && c.state === 'suspended') c.resume().catch(() => {}); };
  document.addEventListener('pointerdown', wake, { passive: true });
  document.addEventListener('keydown', wake);
}

// one note: type, start frequency (glide to `to`), when, how long, loudness
function note(freq, { type = 'sine', at = 0, dur = 0.18, vol = 0.8, to = null, attack = 0.008 } = {}) {
  const c = ctx; if (!c || c.state !== 'running') return;
  const t0 = c.currentTime + at;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.03);
}
const N = { C4: 261.6, E4: 329.6, G4: 392, A4: 440, C5: 523.3, D5: 587.3, E5: 659.3, G5: 784, C6: 1046.5 };

const SOUNDS = {
  tap:   () => note(900, { dur: 0.05, vol: 0.35, to: 600 }),
  pop:   () => { note(420, { dur: 0.12, to: 900, vol: 0.6 }); },
  ding:  () => { note(N.E5, { dur: 0.22, type: 'triangle' }); note(N.A4 * 2, { at: 0.09, dur: 0.3, type: 'triangle', vol: 0.7 }); },
  save:  () => { note(N.G4, { dur: 0.12, type: 'triangle' }); note(N.C5, { at: 0.08, dur: 0.22, type: 'triangle' }); },
  kiss:  () => { note(700, { dur: 0.09, to: 1100, vol: 0.55 }); note(900, { at: 0.12, dur: 0.12, to: 1500, vol: 0.55 }); },
  angry: () => { note(180, { type: 'sawtooth', dur: 0.4, to: 90, vol: 0.45 }); note(190, { type: 'square', at: 0.05, dur: 0.35, to: 95, vol: 0.2 }); },
  sleepy:() => { note(N.E4, { dur: 0.5, to: N.C4, vol: 0.5 }); note(N.C4, { at: 0.45, dur: 0.6, to: 200, vol: 0.4 }); },
  cheer: () => { [N.C5, N.E5, N.G5, N.C6].forEach((f, i) => note(f, { at: i * 0.07, dur: 0.25, type: 'triangle', vol: 0.6 })); },
  error: () => { note(160, { type: 'square', dur: 0.18, vol: 0.3 }); note(140, { type: 'square', at: 0.14, dur: 0.22, vol: 0.3 }); },
  open:  () => note(500, { dur: 0.1, to: 760, vol: 0.4 }),
  deal:  () => { for (let i = 0; i < 4; i++) note(1400 - i * 120, { at: i * 0.06, dur: 0.04, vol: 0.3, type: 'square' }); },
  win:   () => {   // a short fanfare: rising arpeggio, then a bright chord
    [N.C5, N.E5, N.G5].forEach((f, i) => note(f, { at: i * 0.11, dur: 0.22, type: 'triangle', vol: 0.7 }));
    [N.C5, N.E5, N.G5, N.C6].forEach((f) => note(f, { at: 0.42, dur: 0.9, type: 'triangle', vol: 0.45 }));
    note(N.C6 * 1.5, { at: 0.5, dur: 0.6, vol: 0.2 });
  },
  chime: () => { [N.C5, N.G5, N.E5].forEach((f, i) => { note(f, { at: i * 0.14, dur: 0.7, vol: 0.45 }); note(f * 2, { at: i * 0.14, dur: 0.4, vol: 0.15 }); }); }
};

/** Play a named sound. Safe to call anywhere: does nothing when sound is off or not allowed yet. */
export function sfx(name) {
  try { if (!pref('sound')) return; ac(); const f = SOUNDS[name]; if (f) f(); } catch { /* sound is a nicety, never a failure */ }
}
