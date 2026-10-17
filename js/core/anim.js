// Animation helpers. Views are re-rendered as HTML, so we use the FLIP technique:
// measure keyed elements before the render, render, then slide each element from its old spot to its new one.
// Mark elements with data-flip="unique-key". Add data-enter to fade in elements that are new.
// Mark numbers or cards with data-anim="key" data-anim-val="value" to pop/flip when the value changes.

export const reduceMotion = () => {
  try { return !!(globalThis.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); } catch { return false; }
};

const seen = new WeakMap();

export function flipRender(root, renderFn, { animate = true } = {}) {
  const before = new Map();
  const can = animate && !reduceMotion();
  if (can) root.querySelectorAll('[data-flip]').forEach((el) => before.set(el.dataset.flip, el.getBoundingClientRect()));
  renderFn();
  if (can && before.size) {
    root.querySelectorAll('[data-flip]').forEach((el) => {
      if (typeof el.animate !== 'function') return;
      const prev = before.get(el.dataset.flip);
      if (!prev) {
        if (el.hasAttribute('data-enter')) el.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 350, easing: 'ease-out' });
        return;
      }
      const now = el.getBoundingClientRect();
      const dx = prev.left - now.left, dy = prev.top - now.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 600, easing: 'cubic-bezier(.4,0,.2,1)' });
    });
  }
  animChange(root);
}

export function animChange(root) {
  let map = seen.get(root);
  const first = !map;
  if (!map) { map = new Map(); seen.set(root, map); }
  root.querySelectorAll('[data-anim]').forEach((el) => {
    const key = el.dataset.anim;
    const val = el.dataset.animVal ?? el.textContent;
    const old = map.get(key);
    map.set(key, val);
    if (first || old === undefined || old === val || reduceMotion()) return;
    const cls = el.dataset.animCls || 'pop';
    el.classList.add(cls);
    el.addEventListener('animationend', () => el.classList.remove(cls), { once: true });
  });
}

/** Run a render function, but never while someone is typing in a field inside root. */
export function safeRender(root, renderFn, opts) {
  const a = document.activeElement;
  if (a && root.contains(a) && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) {
    return false;
  }
  flipRender(root, renderFn, opts);
  return true;
}
