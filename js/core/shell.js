// Shared phone layout for live game screens: compact info strip, leaderboard tabs, a pane that fills the screen,
// and a fixed bottom dock (tabs + one big action button). The dock never scrolls away.
import { esc } from './util.js';
import { t } from './i18n.js';
import { icon, avatar } from './ui.js';

export function layout({ strip = '', lb = '', pane = '', dock = '', fill = false }) {
  return `<div class="kf">${strip}${lb}<div class="pane ${fill ? 'fill' : ''}" data-pane>${pane}</div>${dock}</div>`;
}

/** tabs: [{id,label,icon}], action: html string for the big button (host only), extra: html placed before the button (like undo) */
export function dock({ tabs, active, action = '', extra = '', viewer = false }) {
  return `<nav class="dock ${viewer ? 'viewer' : ''}" aria-label="Game">
    ${extra}${action}
    <div class="dtabs">${tabs.map((x) => `<button type="button" class="dtab ${x.id === active ? 'on' : ''}" data-tab="${esc(x.id)}" ${x.id === active ? 'aria-current="page"' : ''}>${icon(x.icon, 22)}<span>${esc(t(x.label))}</span></button>`).join('')}</div>
  </nav>`;
}

export function chips(rows, unit = '') {
  return `<div class="lb" aria-label="${esc(t('Leaderboard'))}">${rows.map((r) => `
    <div class="lbchip ${r.rank === 1 && (r.total || r.moved) ? 'first' : ''}" data-flip="lb-${esc(r.id)}" style="${r.out ? 'opacity:.5' : ''}">
      <span class="rk">${r.rank}</span>${avatar(r, 'sm')}
      <b style="max-width:86px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.name)}</b>
      <b data-anim="lb-${esc(r.id)}" data-anim-val="${r.total}" style="font-variant-numeric:tabular-nums">${r.total}${unit ? `<small class="muted"> ${esc(unit)}</small>` : ''}</b>
      ${r.move ? `<small style="font-weight:800;color:${r.move > 0 ? 'var(--ok)' : 'var(--bad)'}">${r.move > 0 ? '▲' : '▼'}${Math.abs(r.move)}</small>` : ''}
    </div>`).join('')}</div>`;
}

/** A list of rows that stretches to fill the pane: 4 players get roomy rows, 10 players still fit without scrolling. */
export const rowsWrap = (n, html) => `<div class="rows" style="grid-template-rows:repeat(${n},minmax(44px,${n <= 6 ? 64 : 56}px));align-content:start">${html}</div>`;

export function menuRow({ id, icon: ic, label, sub = '', danger = false }) {
  return `<button type="button" class="mrow ${danger ? 'danger' : ''}" data-m="${esc(id)}"><span class="ic">${icon(ic, 20)}</span><span class="grow">${esc(t(label))}${sub ? `<small>${esc(sub)}</small>` : ''}</span>${icon('right', 18)}</button>`;
}
