// Shared "Seats and players" sheet. Any game can use it. The game supplies what to show and what each action does.
// opts = {
//   get(): { players:[{id,name,color,out}], locked:boolean, lockedMsg?:string, total?:{id:number}, regulars?:[names], dealerId? }
//   onMove(from,to), onShuffle(), onOut(id,out), onRename(id,name), onAdd(name,start), onRemove(id)?   // any of these can be omitted
//   canRemove?(id): boolean
//   startChoices?: true     // ask what score a new player starts on (0 / lowest / average)
//   warnAdd?(): string|null // text shown when adding a player changes something important (like max cards)
// }
import { clean, clamp, same, suggest } from './names.js';
import { esc } from './util.js';
import { t } from './i18n.js';
import { icon, avatar, openSheet, toast, segHtml } from './ui.js';

export function openSeatsSheet(opts) {
  let start = 'zero';
  let adding = false;
  const sheet = openSheet('', {});
  const draw = () => {
    const g = opts.get();
    const act = g.players.filter((p) => !p.out).length;
    const rows = g.players.map((p, i) => `
      <div class="plrow ${p.out ? 'out' : ''} ${g.dealerId === p.id ? 'dealer' : ''}" data-flip="seat-${esc(p.id)}">
        ${avatar(p, '', p.out)}
        <div class="grow">
          <div class="bold" style="font-size:16px">${esc(p.name)}</div>
          <div class="tiny muted">${p.out ? esc(t('Sitting out')) : esc(t('Seat {n}', { n: i + 1 }))}${g.total ? ' · ' + esc(String(g.total[p.id] ?? 0)) + ' ' + esc(t('pts')) : ''}${g.dealerId === p.id ? ' · ' + esc(t('Dealer')) : ''}</div>
        </div>
        ${opts.onMove ? `<button class="iconbtn light" data-up="${i}" aria-label="${esc(t('Move up'))}" ${i === 0 || g.locked ? 'disabled' : ''}>${icon('up', 20)}</button>
        <button class="iconbtn light" data-down="${i}" aria-label="${esc(t('Move down'))}" ${i === g.players.length - 1 || g.locked ? 'disabled' : ''}>${icon('down', 20)}</button>` : ''}
        ${opts.onOut ? `<button class="chip btnlike" data-out="${esc(p.id)}" ${g.locked || (!p.out && act <= 2) ? 'disabled' : ''}>${esc(t(p.out ? 'Sit in' : 'Sit out'))}</button>` : ''}
      </div>`).join('');
    const reg = (g.regulars || []).filter((n) => !g.players.some((p) => p.name.toLowerCase() === n.toLowerCase()));
    const warn = opts.warnAdd ? opts.warnAdd() : null;
    sheet.setHtml(`
      <h2>${esc(t('Seats and players'))}</h2>
      ${g.locked ? `<div class="note" style="margin-bottom:10px">${esc(t(g.lockedMsg || 'Finish this round first. Seats can change before bids start.'))}</div>` : ''}
      <div class="stack" style="margin-bottom:12px">${rows}</div>
      <div class="row wrap" style="gap:8px;margin-bottom:12px">
        ${opts.onShuffle ? `<button class="btn ghost small" data-shuffle ${g.locked ? 'disabled' : ''}>${icon('shuffle', 18)} ${esc(t('Shuffle seats'))}</button>` : ''}
        ${opts.onAdd ? `<button class="btn dark small" data-addtoggle ${g.locked ? 'disabled' : ''}>${icon('plus', 18)} ${esc(t('Add player'))}</button>` : ''}
      </div>
      ${adding ? `<div class="card stack slidein">
        <input class="input" data-newname placeholder="${esc(t('Name'))}" autocomplete="off" enterkeyhint="done">
        ${reg.length ? `<div class="row wrap" style="gap:6px">${reg.slice(0, 10).map((n) => `<button class="chip btnlike" data-reg="${esc(n)}">${esc(n)}</button>`).join('')}</div>` : ''}
        ${opts.startChoices ? `<div class="label">${esc(t('Starting score'))}</div>${segHtml([{ v: 'zero', label: t('Zero') }, { v: 'lowest', label: t('Lowest') }, { v: 'average', label: t('Average') }], start, 'data-start')}` : ''}
        ${warn ? `<div class="note">${esc(warn)}</div>` : ''}
        <button class="btn primary block" data-addgo>${esc(t('Add to table'))}</button>
      </div>` : ''}
      <button class="btn ghost block" style="margin-top:12px" data-close>${esc(t('Done'))}</button>`);
    if (adding) { const inp = sheet.el.querySelector('[data-newname]'); if (inp && !inp.dataset.focused) { inp.dataset.focused = '1'; setTimeout(() => inp.focus(), 80); } }
  };
  const run = (fn) => { try { fn(); } catch (e) { toast(e.message || String(e), 'bad'); } draw(); };
  sheet.el.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.up != null) return run(() => opts.onMove(+b.dataset.up, +b.dataset.up - 1));
    if (b.dataset.down != null) return run(() => opts.onMove(+b.dataset.down, +b.dataset.down + 1));
    if (b.dataset.out) { const p = opts.get().players.find((x) => x.id === b.dataset.out); return run(() => opts.onOut(b.dataset.out, !p.out)); }
    if ('shuffle' in b.dataset) return run(() => opts.onShuffle());
    if ('addtoggle' in b.dataset) { adding = !adding; return draw(); }
    if (b.dataset.start) { start = b.dataset.start; return draw(); }
    if (b.dataset.usefix) { const inp = sheet.el.querySelector('[data-newname]'); inp.value = b.dataset.usefix; inp.classList.remove('invalid'); const bx = sheet.el.querySelector('[data-dupbox]'); if (bx) bx.remove(); return; }
    if (b.dataset.reg) { const inp = sheet.el.querySelector('[data-newname]'); inp.value = b.dataset.reg; return; }
    if ('addgo' in b.dataset) {
      const name = clean(sheet.el.querySelector('[data-newname]').value);
      if (!name) { toast(t('Type a name first'), 'bad'); return; }
      const taken = opts.get().players.map((p) => p.name);
      if (taken.some((x) => same(x, name))) {
        const fix = suggest(name, taken);
        const inp = sheet.el.querySelector('[data-newname]'); inp.classList.add('invalid');
        let box = sheet.el.querySelector('[data-dupbox]');
        if (!box) { box = document.createElement('div'); box.dataset.dupbox = '1'; box.className = 'note'; box.style.margin = '8px 0'; inp.insertAdjacentElement('afterend', box); }
        box.innerHTML = `${esc(t('"{n}" is already at the table. Change the name, or use:', { n: name }))} <button class="chip btnlike" data-usefix="${esc(fix)}">${esc(fix)}</button>`;
        return;
      }
      adding = false; return run(() => opts.onAdd(name, start));
    }
  });
  sheet.el.addEventListener('input', (e) => { if (e.target.matches('[data-newname]')) { const v = clamp(e.target.value); if (v !== e.target.value) e.target.value = v; e.target.classList.remove('invalid'); } });
  draw();
  return sheet;
}
