"""End game -> share picture -> lock room -> new game with the same players. Needs: node tools/serve.mjs 8099"""
import sys, os
from playwright.sync_api import sync_playwright
from helpers import create_room
BASE = 'http://localhost:8099/'
errors = []
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/opt/pw-browsers/chromium' if os.path.isfile('/opt/pw-browsers/chromium') else None)
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True)
    page = ctx.new_page(); page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(BASE); page.wait_for_selector('[data-guest]'); page.fill('[data-guestname]', 'Vikas'); page.click('[data-guest]'); page.wait_for_selector('.gtile')
    page.click('a[href="#/new/scorebook"]'); page.wait_for_selector('[data-name="0"]')
    for i, n in enumerate(['Vikas', 'Jayesh', 'Meena']):
        if page.locator(f'[data-name="{i}"]').count() == 0: page.click('[data-add]')
        page.fill(f'[data-name="{i}"]', n)
    create_room(page); page.wait_for_selector('[data-roomscreen]'); page.wait_for_selector('.sheet.in'); page.keyboard.press('Escape'); page.wait_for_timeout(500)
    page.click('[data-act="end"]'); page.wait_for_selector('.sheet.in .btn.danger'); page.click('.sheet.in .btn.danger'); page.wait_for_timeout(500)
    page.click('[data-act="sharepic"]'); page.wait_for_selector('.sheet.in img', timeout=5000)
    page.click('.sheet.in [data-fmt="story"]'); page.wait_for_function("() => document.querySelector('.sheet.in img') && document.querySelector('.sheet.in [data-fmt=\"story\"].on')")
    page.keyboard.press('Escape'); page.wait_for_timeout(400)
    page.click('[data-act="lockroom"]'); page.wait_for_selector('.sheet.in .btn.danger, .sheet.in [data-ok]'); page.locator('.sheet.in .btn.danger, .sheet.in [data-ok]').first.click(); page.wait_for_selector('.lockbar', timeout=5000)
    assert page.locator('[data-act="modify"]').count() == 0 and page.locator('[data-act="undo"]').count() == 0
    page.click('[data-newgame]'); page.wait_for_selector('[data-name="0"]')
    vals = [page.input_value(f'[data-name="{i}"]') for i in range(3)]
    assert vals == ['Vikas', 'Jayesh', 'Meena'], vals
    print('ERRORS:', errors or 'none'); assert not errors
    b.close()
print('lock flow passed')
