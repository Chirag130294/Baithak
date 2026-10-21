"""Dealer arc + trump reveal + miss-tap screenshots. Needs: node tools/serve.mjs 8099"""
import sys, os
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8099/'
OUT = sys.argv[2] if len(sys.argv) > 2 else '/tmp/shots'
os.makedirs(OUT, exist_ok=True)
errors = []
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/opt/pw-browsers/chromium' if os.path.isfile('/opt/pw-browsers/chromium') else None)
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, has_touch=True, is_mobile=True)
    page = ctx.new_page(); page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(BASE); page.wait_for_selector('[data-guest]'); page.fill('[data-guestname]', 'Vikas'); page.click('[data-guest]'); page.wait_for_selector('.gtile')
    page.click('a[href="#/new/kachuful"]'); page.wait_for_selector('[data-name="0"]')
    names = ['Vikas', 'Jayesh', 'Meena', 'Hetal', 'Kiran', 'Ritu', 'Amit', 'Neha', 'Sanjay', 'Pooja']
    for i, n in enumerate(names):
        if page.locator(f'[data-name="{i}"]').count() == 0: page.click('[data-add]')
        page.fill(f'[data-name="{i}"]', n)
    # duplicate name is refused with a suggestion
    page.fill('[data-name="9"]', ' vikas ')
    page.click('[data-create]'); page.wait_for_selector('[data-use]')
    page.screenshot(path=f'{OUT}/mo-0-dup.png')
    page.click('[data-use]'); page.wait_for_timeout(200)
    assert page.input_value('[data-name="9"]') == 'vikas 2', page.input_value('[data-name="9"]')
    page.click('[data-create]'); page.wait_for_selector('[data-roomscreen]'); page.wait_for_selector('.sheet.in'); page.keyboard.press('Escape'); page.wait_for_timeout(400)
    rows = page.locator('[data-flip^="row-"]')
    rows.nth(0).locator('[data-inc]').click(); rows.nth(0).locator('[data-inc]').click()   # first bids 1 (total = cards: lock blocked)
    assert page.locator('[data-act="lock"]').is_disabled()
    rows.nth(1).locator('[data-inc]').click(); rows.nth(1).locator('[data-inc]').click()   # second bids 1 too -> total 2, the rest are unbid = auto 0
    page.screenshot(path=f'{OUT}/mo-1-bids.png')
    page.click('[data-act="lock"]'); page.wait_for_timeout(300)
    page.locator('[data-flip^="row-"]').nth(0).click(); page.locator('[data-flip^="row-"]').nth(3).click()
    page.screenshot(path=f'{OUT}/mo-2-miss.png')
    assert page.locator('.prow.missed').count() == 2
    page.click('[data-act="save"]')
    page.wait_for_selector('.reveal-card', timeout=2000)
    page.wait_for_timeout(150)
    anims = page.evaluate("() => [...document.querySelectorAll('.prow')].map(r => r.getAnimations().length)")
    print('anims', anims, page.evaluate("() => document.querySelector('.prow').getBoundingClientRect().top"))
    page.wait_for_timeout(550); page.screenshot(path=f'{OUT}/mo-3-reveal-flip.png')
    assert sum(anims) > 0, anims
    page.wait_for_timeout(2600)
    assert page.locator('.reveal-card').count() == 0, 'reveal removes itself'
    page.screenshot(path=f'{OUT}/mo-4-round2.png')
    # animations Off: no reveal
    page.evaluate("() => localStorage.setItem('baithak:anim','off')")
    for i in range(10): pass
    print('ERRORS:', errors or 'none'); assert not errors
    b.close()
print('motion test passed')
