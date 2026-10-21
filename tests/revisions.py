"""Reasoned changes, struck-through history, ended-game buttons and emoji reactions. Needs: node tools/serve.mjs 8099"""
import sys, re, os
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8099/'
OUT = sys.argv[2] if len(sys.argv) > 2 else '/tmp/shots'
os.makedirs(OUT, exist_ok=True)
errors = []
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/opt/pw-browsers/chromium' if os.path.isfile('/opt/pw-browsers/chromium') else None)
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, has_touch=True, is_mobile=True)
    page = ctx.new_page()
    page.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
    page.goto(BASE); page.wait_for_selector('[data-guest]')
    page.fill('[data-guestname]', 'Vikas'); page.click('[data-guest]'); page.wait_for_selector('.gtile')
    page.click('a[href="#/new/kachuful"]'); page.wait_for_selector('[data-name="0"]')
    for i, n in enumerate(['Vikas', 'Jayesh', 'Meena']):
        if page.locator(f'[data-name="{i}"]').count() == 0: page.click('[data-add]')
        page.fill(f'[data-name="{i}"]', n)
    page.click('[data-create]'); page.wait_for_selector('[data-roomscreen]'); page.wait_for_selector('.sheet.in')
    code = page.inner_text('.sheet.in div[style*="letter-spacing"]').strip()
    page.keyboard.press('Escape'); page.wait_for_timeout(400)

    # play round 1 (1 card): everyone bids 0 except first bids 1, dealer must not bid 0... just use inc buttons
    rows = page.locator('[data-flip^="row-"]')
    for i in range(3): rows.nth(i).locator('[data-inc]').click()
    rows.nth(0).locator('[data-inc]').click()          # first bids 1
    rows.nth(2).locator('[data-inc]').click()          # dealer skips forbidden 0 -> 1
    page.click('[data-act="lock"]'); page.wait_for_timeout(200)
    page.locator('[data-flip^="row-"]').nth(0).click()
    page.click('[data-act="save"]'); page.wait_for_timeout(900)

    # UNDO a saved round needs a reason
    page.click('[data-act="undo"]'); page.wait_for_selector('[data-reason]')
    assert page.locator('[data-ok]').is_disabled(), 'reason required'
    page.fill('[data-reason]', 'x'); assert page.locator('[data-ok]').is_disabled()
    page.click('[data-quick="Tapped the wrong player"]'); page.click('[data-ok]'); page.wait_for_timeout(500)
    page.click('[data-tab="scores"]'); page.wait_for_timeout(300)
    txt = page.inner_text('[data-pane]')
    assert 'Tapped the wrong player' in txt and 're-opened' in txt, txt
    assert page.locator('[data-pane] [style*="line-through"]').count() > 0, 'old score struck through'
    page.screenshot(path=f'{OUT}/rev-1-undo.png')
    page.click('[data-tab="play"]'); page.wait_for_timeout(200)
    page.click('[data-act="save"]'); page.wait_for_timeout(900)       # re-save round 1
    page.click('[data-tab="scores"]'); page.wait_for_timeout(300)
    assert page.locator('[data-pane] [style*="line-through"]').count() > 0, 'history kept after re-save'

    # FIX a round with a reason
    page.click('[data-fix="1"]'); page.wait_for_selector('[data-why]')
    assert page.locator('[data-savefix]').is_disabled()
    page.locator('[data-tg]').nth(1).click()
    page.fill('[data-why]', 'Miscounted tricks'); assert page.locator('[data-savefix]').is_enabled()
    page.click('[data-savefix]'); page.wait_for_timeout(500)
    txt = page.inner_text('[data-pane]')
    assert 'Miscounted tricks' in txt and 'fixed' in txt
    page.screenshot(path=f'{OUT}/rev-2-fix.png')

    # END the game: no undo / pause / seats; Modify exists
    page.click('[data-tab="more"]'); page.click('[data-m="end"]')
    page.wait_for_selector('.sheet.in [data-ok], .sheet.in .btn.danger')
    page.locator('.sheet.in .btn.danger, .sheet.in [data-ok]').first.click(); page.wait_for_timeout(500)
    assert page.locator('[data-act="undo"]').count() == 0
    assert page.locator('[data-act="modify"]').count() >= 1
    page.click('[data-tab="more"]'); page.wait_for_timeout(200)
    more = page.inner_text('[data-pane]')
    assert 'Pause' not in more and 'Seats' not in more and 'Scoring' not in more and 'Modify' in more, more
    page.screenshot(path=f'{OUT}/rev-3-ended-more.png')
    page.click('.dockbtn[data-act="modify"]'); page.wait_for_selector('[data-pick]'); page.click('[data-pick="1"]')
    page.wait_for_selector('[data-why]'); page.keyboard.press('Escape')

    # REACTIONS: viewer in the same browser sees the host's reaction
    viewer = ctx.new_page()
    viewer.on('pageerror', lambda e: errors.append('viewer pageerror: ' + str(e)))
    viewer.goto(BASE); viewer.evaluate("() => { const u = JSON.parse(localStorage.getItem('baithak:user')); u.uid = 'viewer1'; u.name = 'Friend'; localStorage.setItem('baithak:user', JSON.stringify(u)); }")
    viewer.goto(BASE + '#/r/' + code); viewer.reload(); viewer.wait_for_selector('[data-roomscreen] .lb')
    viewer.click('.rx-fab'); viewer.wait_for_selector('.rx-tray:not([hidden])')
    assert viewer.locator('.rx-b').count() == 10
    viewer.click('.rx-c[data-aim="Jayesh"]'); viewer.click('.rx-b[data-k="hammer"]')
    page.wait_for_function("() => document.querySelectorAll('.rx-el').length > 0", timeout=3000)
    page.wait_for_timeout(1100); page.screenshot(path=f'{OUT}/rev-4-reaction-host.png')
    viewer.wait_for_timeout(1000)
    for k in ['fire', 'party', 'clap', 'splash', 'laugh', 'tomato', 'clown', 'skull', 'heart']:
        viewer.click('.rx-fab'); viewer.click(f'.rx-b[data-k="{k}"]'); viewer.wait_for_timeout(800)
    page.wait_for_timeout(1500)
    print('ERRORS:', errors or 'none')
    assert not errors
    b.close()
print('revisions test passed', code)
