// CSV export of a final split (who owes whom) for apps like Oweize, plus sharing it from a phone.
import { toast } from './ui.js';
import { t } from './i18n.js';

const q = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
export const CSV_HEADER = ['Date', 'Description', 'Cost', 'Who Paid', 'Who Owes'];

/**
 * split: [{ from, to, amount }]  from = the person who owes, to = the person who is owed (names, not ids).
 * Each payment becomes one expense: "to" is entered as the one who paid, "from" is the one who owes it.
 */
export function splitToCsv(split, { date = new Date(), description = 'Teen Patti settle up' } = {}) {
  const d = (date instanceof Date ? date : new Date(date));
  const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const rows = split.map((p) => [day, `${description}: ${p.from} pays ${p.to}`, Number(p.amount).toFixed(2), p.to, p.from]);
  return '﻿' + [CSV_HEADER, ...rows].map((r) => r.map(q).join(',')).join('\r\n') + '\r\n';
}

/** Opens the phone's share sheet with the CSV as a file. Falls back to a normal download. */
export async function shareCsv(csv, filename = 'baithak-split.csv', title = 'Baithak split') {
  const file = new File([csv], filename, { type: 'text/csv' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title, text: title }); return 'shared'; }
    catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file); a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast(t('CSV saved. Open it from Files or Downloads, then import it in Oweize.'), 'ok');
  return 'downloaded';
}
