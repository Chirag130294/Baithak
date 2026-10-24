// A small sheet that asks the host WHY a saved score is being changed. The reason is required and stays in the history.
import { esc } from './util.js';
import { t } from './i18n.js';
import { openSheet } from './ui.js';

export const MIN_REASON = 3;
export const validReason = (r) => typeof r === 'string' && r.trim().length >= MIN_REASON;
export const cleanReason = (r) => String(r || '').trim().replace(/\s+/g, ' ').slice(0, 120);
const QUICK = ['Wrong bid entered', 'Tapped the wrong player', 'Miscounted tricks', 'Players agreed to change'];

/** Resolves with the reason text, or null if cancelled. */
export function askReason({ title, text = '', ok = 'Save change' }) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    const sh = openSheet(`<h2>${esc(title)}</h2>
      ${text ? `<p class="muted" style="margin-bottom:10px">${esc(text)}</p>` : ''}
      <div class="label">${esc(t('Reason (required)'))}</div>
      <input class="input" data-reason maxlength="120" placeholder="${esc(t('Why is this being changed?'))}" autocomplete="off" style="width:100%;margin-bottom:8px">
      <div class="row" style="flex-wrap:wrap;gap:6px;margin-bottom:12px">${QUICK.map((q) => `<button type="button" class="chip btnlike" data-quick="${esc(q)}">${esc(t(q))}</button>`).join('')}</div>
      <div class="row" style="gap:8px"><button class="btn ghost grow" data-close>${esc(t('Cancel'))}</button><button class="btn primary grow" data-ok disabled>${esc(t(ok))}</button></div>`,
    { onClose: () => finish(null) });
    const input = sh.el.querySelector('[data-reason]'), okBtn = sh.el.querySelector('[data-ok]');
    const sync = () => { okBtn.disabled = !validReason(input.value); };
    input.addEventListener('input', sync);
    sh.el.addEventListener('click', (e) => {
      const q = e.target.closest('[data-quick]');
      if (q) { input.value = q.dataset.quick; sync(); return; }
      if (e.target.closest('[data-ok]') && validReason(input.value)) { finish(cleanReason(input.value)); sh.close(); }
    });
    setTimeout(() => input.focus(), 250);
  });
}
