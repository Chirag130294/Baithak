// Sharing helpers: copy link, WhatsApp text, and a picture card of the standings that can be shared as an image.
import { t } from './i18n.js';
import { toast } from './ui.js';

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
