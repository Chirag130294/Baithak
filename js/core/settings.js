// "Customize" sheet: everything here is kept on this phone and applies straight away.
import { esc } from './util.js';
import { t } from './i18n.js';
import { openSheet, buzz } from './ui.js';
import { getPrefs, setPref, resetPrefs, ACCENTS, SKINS } from './prefs.js';
import { animLevel, setAnimLevel } from './anim.js';
import { sfx } from './sound.js';
import { supported as wakeSupported, isOn as keepAwakeOn, setKeepAwake } from './wake.js';

const seg = (attr, opts, value) => `<div class="seg">${opts.map(([v, label]) => `<button type="button" class="${String(v) === String(value) ? 'on' : ''}" ${attr}="${esc(v)}">${esc(t(label))}</button>`).join('')}</div>`;
const sw = (attr, on) => `<button type="button" class="switch ${on ? 'on' : ''}" ${attr} role="switch" aria-checked="${!!on}"><i></i></button>`;
const skinCard = (k, s, on) => `<button type="button" class="skincard ${on ? 'on' : ''}" data-pref-skin="${k}" aria-pressed="${on}" aria-label="${esc(s.name)}">
  <span class="skmini" style="--bg:${s.sw.bg};--top:${s.sw.top};--btn:${s.sw.btn};--ink:${s.sw.ink}"><i class="skt"></i><i class="skl"></i><i class="skl s"></i><i class="skb"></i></span>
  <b>${esc(t(s.name))}</b><small>${esc(t(s.note))}</small></button>`;

export function openSettings({ onChange } = {}) {
  const draw = () => {
    const p = getPrefs(), green = p.skin === 'green';
    return `<h2>${esc(t('Customize'))}</h2><div class="stack set-stack">
      <div><div class="label">${esc(t('Colour theme'))}</div><div class="skins">${Object.entries(SKINS).map(([k, s]) => skinCard(k, s, p.skin === k)).join('')}</div></div>
      <div><div class="label">${esc(t('Look'))}</div>${seg('data-pref-look', [['sleek', 'Sleek (compact)'], ['classic', 'Classic (big buttons)']], p.look)}</div>
      ${green ? `<div class="set-2"><div><div class="label">${esc(t('Mode'))}</div>${seg('data-pref-theme', [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']], p.theme)}</div>
        <div><div class="label">${esc(t('Colour'))}</div><div class="swatches">${Object.entries(ACCENTS).map(([k, a]) => `<button type="button" class="swatch ${p.accent === k ? 'on' : ''}" data-pref-accent="${k}" style="background:${a.c}" aria-label="${esc(a.name)}"></button>`).join('')}</div></div></div>` : ''}
      <div class="set-2"><div><div class="label">${esc(t('Text size'))}</div>${seg('data-pref-size', [['s', 'Small'], ['m', 'Normal'], ['l', 'Large']], p.size)}</div>
        <div><div class="label">${esc(t('Animations'))}</div>${seg('data-pref-anim', [['full', 'Full'], ['light', 'Light'], ['off', 'Off']], animLevel())}</div></div>
      <div class="set-list">
        <div class="row between"><span>${esc(t('Vibration on taps'))}</span>${sw('data-pref-haptics', p.haptics)}</div>
        <div class="row between"><span>${esc(t('Sound effects'))}</span>${sw('data-pref-sound', p.sound)}</div>
        <div class="row between"><span>${esc(t('Show emoji reactions'))}</span>${sw('data-pref-reactions', p.reactions)}</div>
        ${wakeSupported() ? `<div class="row between"><span>${esc(t('Keep screen on'))}</span>${sw('data-pref-awake', keepAwakeOn())}</div>` : ''}
      </div>
      <div class="sheet-foot"><button class="btn ghost grow" data-pref-reset>${esc(t('Reset'))}</button><button class="btn primary grow" data-close>${esc(t('Done'))}</button></div></div>`;
  };
  const sh = openSheet(draw());
  sh.el.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const d = b.dataset; let changed = true;
    if ('prefSkin' in d) setPref('skin', d.prefSkin);
    else if ('prefLook' in d) setPref('look', d.prefLook);
    else if ('prefTheme' in d) setPref('theme', d.prefTheme);
    else if ('prefAccent' in d) setPref('accent', d.prefAccent);
    else if ('prefSize' in d) setPref('size', d.prefSize);
    else if ('prefAnim' in d) { setAnimLevel(d.prefAnim); document.documentElement.dataset.anim = d.prefAnim; }
    else if ('prefHaptics' in d) { setPref('haptics', !getPrefs().haptics); }
    else if ('prefSound' in d) { setPref('sound', !getPrefs().sound); if (getPrefs().sound) sfx('chime'); }
    else if ('prefReactions' in d) { setPref('reactions', !getPrefs().reactions); }
    else if ('prefAwake' in d) { setKeepAwake(!keepAwakeOn()); }
    else if ('prefReset' in d) { resetPrefs(); setAnimLevel('full'); document.documentElement.dataset.anim = 'full'; }
    else changed = false;
    if (!changed) return;
    buzz(10);
    const sc = sh.el.parentElement ? sh.el.parentElement.scrollTop : 0;
    sh.setHtml(draw());
    if (sh.el.parentElement) sh.el.parentElement.scrollTop = sc;
    if (onChange) onChange(getPrefs());
  });
  return sh;
}
