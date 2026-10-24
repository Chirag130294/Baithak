// Device preferences (kept on this phone): skin (colour theme), look (sleek or classic sizes), accent colour, text size, vibration, sound, reactions.
// Applied straight away by setting attributes on <html>; css/skins.css, css/sleek.css and css/base.css do the rest.
const KEY = 'baithak:prefs';
export const DEFAULT_PREFS = { skin: 'green', look: 'sleek', theme: 'auto', accent: 'green', size: 'm', density: 'comfy', haptics: true, sound: true, reactions: true };

/** Colour skins. `bar` is the phone's status-bar colour; `sw` is the little preview used in Customize. */
export const SKINS = {
  green:  { name: 'Felt Green',    note: 'The original',        bar: '#12352B', sw: { bg: '#F1F4EF', top: '#12352B', btn: '#F2A71B', ink: '#12261F' } },
  gold:   { name: 'Midnight Gold', note: 'Dark and elegant',     bar: '#082a1f', sw: { bg: '#07100d', top: '#0c3b2c', btn: '#E6B84C', ink: '#EDF4F0' } },
  clean:  { name: 'Clean Light',   note: 'White and minimal',    bar: '#ffffff', sw: { bg: '#F6F7F6', top: '#ffffff', btn: '#0B0F0D', ink: '#0B0F0D' } },
  arcade: { name: 'Arcade Purple', note: 'Bright and playful',   bar: '#46178F', sw: { bg: '#F1ECFF', top: '#5A28A8', btn: '#FFC107', ink: '#1A1033' } }
};
export const LOOKS = { sleek: 'Sleek (compact)', classic: 'Classic (big buttons)' };

export const ACCENTS = {
  green:  { name: 'Felt green', c: '#12352B', c2: '#1D4A3C', c3: '#2A5B4A', deep: '#0F2E25' },
  blue:   { name: 'Midnight', c: '#14304F', c2: '#1F4568', c3: '#2C5A82', deep: '#0F2540' },
  plum:   { name: 'Plum', c: '#3A1F4D', c2: '#4D2C64', c3: '#623A7E', deep: '#2D173C' },
  maroon: { name: 'Maroon', c: '#4F1D24', c2: '#672A32', c3: '#7F3841', deep: '#3C1419' },
  slate:  { name: 'Slate', c: '#26323B', c2: '#34434E', c3: '#445764', deep: '#1B252C' }
};
export const SIZES = { s: 0.94, m: 1, l: 1.1 };

let cache = null;
export function getPrefs() {
  if (cache) return cache;
  let saved = {};
  try { saved = JSON.parse(globalThis.localStorage.getItem(KEY) || '{}') || {}; } catch { saved = {}; }
  cache = { ...DEFAULT_PREFS, ...saved };
  if (!SKINS[cache.skin]) cache.skin = 'green';
  if (!LOOKS[cache.look]) cache.look = 'sleek';
  return cache;
}
export const pref = (k) => getPrefs()[k];
export function setPref(k, v) {
  cache = { ...getPrefs(), [k]: v };
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* storage blocked */ }
  applyPrefs();
}
export function resetPrefs() { cache = { ...DEFAULT_PREFS }; try { localStorage.removeItem(KEY); } catch { /* ignore */ } applyPrefs(); }

export function applyPrefs() {
  if (typeof document === 'undefined' || !document.documentElement || !document.documentElement.style) return;   // tests and servers have no page
  const p = getPrefs(), el = document.documentElement, a = ACCENTS[p.accent] || ACCENTS.green, sk = SKINS[p.skin] || SKINS.green;
  const green = p.skin === 'green';
  el.dataset.skin = p.skin;
  el.dataset.look = p.look;
  // light / dark / auto and the accent swatches only belong to the original Felt Green skin
  if (green && p.theme !== 'auto') el.setAttribute('data-theme', p.theme); else el.removeAttribute('data-theme');
  el.dataset.density = p.density;
  el.style.setProperty('--zoom', String(SIZES[p.size] || 1));
  if (!green || p.accent === 'green') ['--felt', '--felt2', '--felt3', '--felt-deep'].forEach((k) => el.style.removeProperty(k));
  else { el.style.setProperty('--felt', a.c); el.style.setProperty('--felt2', a.c2); el.style.setProperty('--felt3', a.c3); el.style.setProperty('--felt-deep', a.deep); }
  const meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.setAttribute('content', green ? a.c : sk.bar);
  let lvl = 'full'; try { lvl = localStorage.getItem('baithak:anim') || 'full'; } catch { /* ignore */ }
  el.dataset.anim = lvl;
}
applyPrefs();
