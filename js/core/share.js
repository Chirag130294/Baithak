// Sharing helpers: copy link, WhatsApp text, and a picture card of the standings that can be shared as an image.
import { t } from './i18n.js';
import { toast, openSheet } from './ui.js';
import { qrMatrix } from './qr.js';
import { esc } from './util.js';

export const roomUrl = (code, mode) => {
  const base = location.origin + location.pathname.replace(/index\.html$/, '');
  return `${base}#/r/${code}${mode === 'scores' ? '?enter=1' : ''}`;
};

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast(t('Copied'), 'ok'); return true; }
  catch {
    const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch { /* ignore */ }
    ta.remove(); toast(ok ? t('Copied') : t('Could not copy'), ok ? 'ok' : 'bad'); return ok;
  }
}

export async function shareText(text, url) {
  if (navigator.share) { try { await navigator.share({ text, url }); return true; } catch (e) { if (e && e.name === 'AbortError') return false; } }
  window.open('https://wa.me/?text=' + encodeURIComponent(url ? text + '\n' + url : text), '_blank', 'noopener');
  return true;
}

/** Draws a standings card (title, subtitle, rows of {rank,name,total,gain}) onto a canvas and returns a PNG blob. */
export function standingsCard({ title, subtitle = '', rows, footer = 'Baithak' }) {
  const W = 900, rowH = 84, H = 300 + rows.length * rowH + 90;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.fillStyle = '#12352B'; x.fillRect(0, 0, W, H);
  x.fillStyle = '#F2A71B'; x.fillRect(0, 0, W, 10);
  x.fillStyle = '#fff'; x.font = '700 58px "Bricolage Grotesque", "Noto Sans Gujarati", system-ui, sans-serif'; x.fillText(title, 56, 120);
  x.fillStyle = '#CFE0D7'; x.font = '500 34px system-ui, sans-serif'; x.fillText(subtitle, 56, 176);
  rows.forEach((r, i) => {
    const y = 230 + i * rowH;
    x.fillStyle = i === 0 ? '#F2A71B' : '#1D4A3C'; roundRect(x, 40, y, W - 80, rowH - 12, 18); x.fill();
    x.fillStyle = i === 0 ? '#12261F' : '#fff';
    x.font = '700 38px system-ui, sans-serif'; x.fillText(String(r.rank), 70, y + 50);
    x.font = '600 38px "Noto Sans Gujarati", system-ui, sans-serif'; x.fillText(String(r.name).slice(0, 18), 140, y + 50);
    x.textAlign = 'right'; x.font = '700 40px system-ui, sans-serif'; x.fillText(String(r.total), W - 70, y + 50);
    if (r.gain != null && r.gain !== '') { x.font = '500 26px system-ui, sans-serif'; x.fillStyle = i === 0 ? '#4A3300' : '#9FD4B6'; x.fillText((r.gain > 0 ? '+' : '') + r.gain, W - 220, y + 48); }
    x.textAlign = 'left';
  });
  x.fillStyle = '#9FB1A7'; x.font = '500 28px system-ui, sans-serif'; x.fillText(footer, 56, H - 40);
  return new Promise((res) => c.toBlob((b) => res(b), 'image/png'));
}
function roundRect(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }

export async function shareCardImage(card, filename = 'baithak-standings.png', text = '') {
  const blob = await standingsCard(card);
  const file = new File([blob], filename, { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], text }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast(t('Picture saved. Share it from your gallery.'), 'ok');
}


// ---------------- game-over share picture (feed 1080x1350, story 1080x1920) ----------------
export const siteUrl = () => location.origin + location.pathname.replace(/index\.html$/, '');
const FONT = '"Bricolage Grotesque", "Noto Sans Gujarati", system-ui, -apple-system, "Segoe UI", sans-serif';
const fit = (x, text, maxW, font, startPx) => { let px = startPx; do { x.font = font.replace('{px}', px); px -= 2; } while (x.measureText(text).width > maxW && px > 18); return text; };

/** card = { title, subtitle, rows:[{rank,name,total,gain?}], highlights?:[string], footer?, date? }; format 'feed' | 'story' */
export function gameOverCard(card, format = 'feed') {
  const W = 1080, H = format === 'story' ? 1920 : 1350;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  // felt background with soft light and suit motifs
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#16503c'); g.addColorStop(0.55, '#0f3d2e'); g.addColorStop(1, '#0a2a20');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  const glow = x.createRadialGradient(W / 2, 330, 40, W / 2, 330, 640); glow.addColorStop(0, 'rgba(242,167,27,.28)'); glow.addColorStop(1, 'rgba(242,167,27,0)');
  x.fillStyle = glow; x.fillRect(0, 0, W, H);
  x.save(); x.globalAlpha = 0.07; x.fillStyle = '#fff'; x.font = '220px serif';
  [['♠', 60, 520, -12], ['♥', 820, 700, 10], ['♦', 120, 1000, 8], ['♣', 800, 1180, -8], ['♠', 860, 250, 14], ['♥', 40, 200, -6]].forEach(([ch, px, py, rot]) => { x.save(); x.translate(px, py); x.rotate(rot * Math.PI / 180); x.fillText(ch, 0, 0); x.restore(); });
  x.restore();
  x.fillStyle = '#F2A71B'; x.fillRect(0, 0, W, 12);

  // header
  x.textAlign = 'center'; x.fillStyle = '#F2C566'; x.font = `700 30px ${FONT}`;
  x.fillText('B A I T H A K', W / 2, 86);
  x.fillStyle = '#fff'; x.font = `800 74px ${FONT}`; fit(x, card.title, W - 140, `800 {px}px ${FONT}`, 74); x.fillText(card.title, W / 2, 178);
  x.fillStyle = '#BFD6CB'; x.font = `500 34px ${FONT}`; x.fillText(card.subtitle || '', W / 2, 228);

  // winner banner (skipped on a crowded table: the podium already says it)
  const rows = (card.rows || []).slice();
  const compact = rows.length > 6;
  const winners = rows.filter((r) => r.rank === 1);
  const wname = winners.map((r) => r.name).join(' & ') || '';
  let y = compact ? 262 : 275;
  if (!compact) {
    x.fillStyle = '#F2A71B'; roundRect(x, 90, y, W - 180, 150, 34); x.fill();
    x.fillStyle = '#3B2800'; x.font = `700 26px ${FONT}`; x.fillText('🏆  W I N N E R', W / 2, y + 48);
    x.fillStyle = '#12261F'; fit(x, wname, W - 260, `800 {px}px ${FONT}`, 62); x.fillText(wname, W / 2, y + 112);
    y += 150 + 40;
  }

  // podium: the first three places with medals (a tie shares the medal)
  const top = rows.slice(0, 3);
  if (top.length >= 2) {
    const order = top.length === 3 ? [top[1], top[0], top[2]] : [top[1], top[0]];
    const heights = (compact ? [140, 190, 112] : [190, 260, 150]).slice(0, top.length === 3 ? 3 : 2);
    if (top.length === 2) heights.splice(0, 2, ...(compact ? [140, 190] : [190, 260]));
    const colW = 280, gap = 22, total = order.length * colW + (order.length - 1) * gap, x0 = (W - total) / 2, base = y + (compact ? 262 : 330);
    order.forEach((r, i) => {
      const h = heights[i], cx = x0 + i * (colW + gap), medal = r.rank === 1 ? '#F2A71B' : r.rank === 2 ? '#C9D3CD' : '#C98A52';
      x.fillStyle = 'rgba(255,255,255,.10)'; roundRect(x, cx, base - h, colW, h, 22); x.fill();
      x.fillStyle = medal; x.beginPath(); x.arc(cx + colW / 2, base - h - 4, 34, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#12261F'; x.font = `800 38px ${FONT}`; x.fillText(String(r.rank), cx + colW / 2, base - h + 8);
      x.fillStyle = '#fff'; fit(x, r.name, colW - 30, `700 {px}px ${FONT}`, 38); x.fillText(r.name, cx + colW / 2, base - h + (compact ? 52 : 62));
      x.fillStyle = medal; x.font = `800 ${compact ? 40 : 46}px ${FONT}`; x.fillText(String(r.total), cx + colW / 2, base - h + (compact ? 100 : 118));
    });
    y = base + 40;
  }

  // everyone else, with their place and score. One column up to 6 players, two columns after that, so all 15 fit.
  const rest = rows.slice(top.length >= 2 ? 3 : 0);
  const footTop = H - 215 - 16;
  if (rest.length) {
    const cols = rest.length > 6 ? 2 : 1, per = Math.ceil(rest.length / cols);
    const rowH = Math.max(40, Math.min(H > 1500 ? 112 : 78, Math.floor((footTop - y - (card.highlights && card.highlights.length ? 70 : 0)) / per)));
    const colW2 = cols === 2 ? (W - 180 - 24) / 2 : W - 180, fs = Math.max(22, Math.min(H > 1500 ? 46 : 36, Math.round(rowH * 0.46)));
    rest.forEach((r, i) => {
      const col = cols === 2 ? Math.floor(i / per) : 0, ri = cols === 2 ? i % per : i;
      const rx = 90 + col * (colW2 + 24), ry = y + ri * rowH;
      x.fillStyle = 'rgba(255,255,255,.08)'; roundRect(x, rx, ry, colW2, rowH - 10, 16); x.fill();
      x.textAlign = 'left'; x.fillStyle = '#F2C566'; x.font = `700 ${fs}px ${FONT}`; x.fillText(String(r.rank), rx + 22, ry + (rowH - 10) / 2 + fs * 0.35);
      x.fillStyle = '#fff'; fit(x, r.name, colW2 - 190, `600 {px}px ${FONT}`, fs); x.fillText(r.name, rx + 22 + fs * 1.4, ry + (rowH - 10) / 2 + fs * 0.35);
      x.textAlign = 'right'; x.font = `800 ${fs}px ${FONT}`; x.fillText(String(r.total), rx + colW2 - 20, ry + (rowH - 10) / 2 + fs * 0.35);
    });
    y += per * rowH + 6;
  }

  // highlights (only when there is room left)
  x.textAlign = 'center';
  (card.highlights || []).slice(0, 3).forEach((tx, i) => {
    const hy = y + 40 + i * 52;
    if (hy > footTop) return;
    x.fillStyle = 'rgba(242,167,27,.16)'; const w = Math.min(W - 200, 40 + tx.length * 17); roundRect(x, (W - w) / 2, hy - 34, w, 46, 23); x.fill();
    x.fillStyle = '#F7DB9C'; x.font = `600 26px ${FONT}`; x.fillText(tx, W / 2, hy);
  });

  // footer: date + room on the left, QR on the right, subtle credit at the very bottom
  const fy = H - 215;
  x.textAlign = 'left'; x.fillStyle = '#E4EFE9'; x.font = `600 30px ${FONT}`; x.fillText(card.footer || 'Baithak', 90, fy + 62);
  x.fillStyle = '#93AFA2'; x.font = `500 26px ${FONT}`; x.fillText(card.date || new Date().toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' }), 90, fy + 104);
  x.fillStyle = '#93AFA2'; x.font = `500 24px ${FONT}`; x.fillText('Scan to watch or play on Baithak', 90, fy + 146);
  const m = qrMatrix(siteUrl());
  if (m) {
    const n = m.length, q = 4, size = 180, cell = size / (n + q * 2), qx = W - 90 - size, qy = fy - 6;
    x.fillStyle = '#fff'; roundRect(x, qx, qy, size, size, 18); x.fill();
    x.fillStyle = '#12261F';
    m.forEach((row, r) => row.forEach((on, cc) => { if (on) x.fillRect(qx + (cc + q) * cell, qy + (r + q) * cell, Math.ceil(cell), Math.ceil(cell)); }));
  }
  x.textAlign = 'center'; x.fillStyle = 'rgba(242,197,102,.55)'; x.font = `italic 500 24px Georgia, "Times New Roman", serif`; x.fillText('Crafted by Chirag', W / 2, H - 36);
  return new Promise((res) => c.toBlob((b) => res(b), 'image/png'));
}

async function shareBlob(blob, filename, text) {
  const file = new File([blob], filename, { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], text }); return 'shared'; } catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast(t('Picture saved. Share it from your gallery.'), 'ok');
  return 'downloaded';
}

/** Shows a preview with two sizes (feed / story) and shares the one the person picks. Works for the host and for viewers. */
export async function openSharePicture(card, filenameBase = 'baithak', text = '') {
  let fmt = 'feed', blob = null, url = '';
  const sh = openSheet(`<h2>${esc(t('Share picture'))}</h2><div class="shimmer" style="height:300px"></div>`);
  const draw = async () => {
    blob = await gameOverCard(card, fmt);
    if (url) URL.revokeObjectURL(url); url = URL.createObjectURL(blob);
    sh.setHtml(`<h2>${esc(t('Share picture'))}</h2>
      <div class="seg" style="margin-bottom:10px"><button class="${fmt === 'feed' ? 'on' : ''}" data-fmt="feed">${esc(t('Post'))} 1080×1350</button><button class="${fmt === 'story' ? 'on' : ''}" data-fmt="story">${esc(t('Story'))} 1080×1920</button></div>
      <div style="text-align:center"><img alt="" src="${url}" style="max-width:100%;max-height:46vh;border-radius:14px;box-shadow:0 8px 24px #0003"></div>
      <div class="row" style="gap:8px;margin-top:12px"><button class="btn ghost grow" data-close>${esc(t('Close'))}</button><button class="btn primary grow" data-go>${esc(t('Share'))}</button></div>`);
  };
  sh.el.addEventListener('click', async (e) => {
    const f = e.target.closest('[data-fmt]'); if (f) { fmt = f.dataset.fmt; return draw(); }
    if (e.target.closest('[data-go]') && blob) { await shareBlob(blob, `${filenameBase}-${fmt}.png`, text); }
  });
  await draw();
  return sh;
}
