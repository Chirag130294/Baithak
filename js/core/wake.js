// Keeps the phone screen awake while a game is open (Screen Wake Lock). Safe to call anywhere: if the phone
// or browser does not support it, nothing happens. The lock is re-requested after the app comes back to the front.
import { ls } from './util.js';

let sentinel = null, wanted = false;
const KEY = 'baithak:keepAwake';
export const supported = () => 'wakeLock' in navigator;
export const isOn = () => ls.get(KEY, true) !== false;

async function acquire() {
  if (!wanted || !supported() || document.visibilityState !== 'visible' || sentinel) return;
  try {
    sentinel = await navigator.wakeLock.request('screen');
    sentinel.addEventListener('release', () => { sentinel = null; });
  } catch { sentinel = null; /* battery saver or no permission: ignore */ }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') acquire(); });

export function keepAwake() { wanted = isOn(); acquire(); }
export function allowSleep() { wanted = false; if (sentinel) { sentinel.release().catch(() => {}); sentinel = null; } }
export function setKeepAwake(on) { ls.set(KEY, !!on); if (on) keepAwake(); else allowSleep(); }
