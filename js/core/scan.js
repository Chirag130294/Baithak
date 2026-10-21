// Camera QR scanner in a bottom sheet. Uses the phone's built-in BarcodeDetector when it has one.
// Where it does not (some iPhones), the sheet explains and offers the code box instead.
import { esc, parseCode } from './util.js';
import { t } from './i18n.js';
import { openSheet, icon } from './ui.js';

export const canScan = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) && 'BarcodeDetector' in window;

export function openScanner(onCode) {
  let stream = null, raf = 0, stopped = false;
  const stop = () => { stopped = true; cancelAnimationFrame(raf); if (stream) stream.getTracks().forEach((tr) => tr.stop()); };
  const sheet = openSheet(`
    <h2>${esc(t("Scan the host's QR code"))}</h2>
    <div style="position:relative;border-radius:18px;overflow:hidden;background:#000;aspect-ratio:1/1">
      <video playsinline muted style="width:100%;height:100%;object-fit:cover"></video>
      <div style="position:absolute;inset:18%;border:3px solid #F2A71B;border-radius:18px;box-shadow:0 0 0 999px #0006"></div>
    </div>
    <p class="muted small center" data-msg style="margin:10px 0">${esc(t('Point your camera at the QR code on the host\'s phone.'))}</p>
    <button class="btn ghost block" data-close>${esc(t('Type the code instead'))}</button>`, { onClose: stop });
  const msg = sheet.el.querySelector('[data-msg]');
  const video = sheet.el.querySelector('video');
  (async () => {
    if (!canScan()) { msg.textContent = t('This browser cannot scan QR codes. Use your phone camera app on the QR code, or type the code.'); video.parentElement.style.display = 'none'; return; }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      if (stopped) { stop(); return; }
      video.srcObject = stream; await video.play();
      const det = new BarcodeDetector({ formats: ['qr_code'] });
      const tick = async () => {
        if (stopped) return;
        try {
          const found = await det.detect(video);
          for (const f of found) { const code = parseCode(f.rawValue); if (code) { sheet.close(); onCode(code); return; } }
        } catch { /* keep trying */ }
        raf = requestAnimationFrame(tick);
      };
      tick();
    } catch (e) {
      msg.textContent = t('Camera permission was not given. You can type the code instead.');
      video.parentElement.style.display = 'none';
    }
  })();
  return sheet;
}
