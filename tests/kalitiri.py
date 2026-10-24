"""All five round-book games: reasons + history, Kali Tiri flow. Needs: node tools/serve.mjs 8099"""
import sys, os
from playwright.sync_api import sync_playwright
from helpers import create_room
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8099/'
OUT = sys.argv[2] if len(sys.argv) > 2 else '/tmp/shots'
os.makedirs(OUT, exist_ok=True)
errors = []
def new_room(page, game, n):
    page.goto(BASE + '#/'); page.wait_for_selector('.gtile')
    page.click(f'a[href="#/new/{game}"]'); page.wait_for_selector('[data-name="0"]')
    for i, nm in enumerate(['Vikas', 'Jayesh', 'Meena', 'Hetal', 'Kiran', 'Ritu'][:n]):
        if page.locator(f'[data-name="{i}"]').count() == 0: page.click('[data-add]')
        page.fill(f'[data-name="{i}"]', nm)
    create_room(page); page.wait_for_selector('[data-roomscreen]'); page.wait_for_selector('.sheet.in'); page.keyboard.press('Escape'); page.wait_for_timeout(400)

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/opt/pw-browsers/chromium' if os.path.isfile('/opt/pw-browsers/chromium') else None)
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, has_touch=True, is_mobile=True)
    page = ctx.new_page(); page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(BASE); page.wait_for_selector('[data-guest]'); page.fill('[data-guestname]', 'Vikas'); page.click('[data-guest]'); page.wait_for_selector('.gtile')

    # ---- Kali Tiri ----
    new_room(page, 'kalitiri', 5)
    page.click('[data-act="add"]'); page.wait_for_selector('[data-bidder]')
    assert page.locator('[data-ok]').is_disabled()
    page.click('[data-bidder]:has-text("Vikas")'); page.click('[data-partner]:has-text("Jayesh")'); page.click('[data-bid="200"]')
    page.click('[data-trump="S"]'); page.click('[data-made="1"]')
    page.screenshot(path=f'{OUT}/kt-1-sheet.png')
    page.click('[data-ok]'); page.wait_for_timeout(500)
    txt = page.inner_text('body')
    assert '200' in txt, txt[:500]
    page.screenshot(path=f'{OUT}/kt-2-book.png')
    # fix with reason
    page.locator('tr[data-edit="1"]').click(); page.wait_for_selector('[data-why]')
    assert page.locator('[data-ok]').is_disabled()
    page.click('[data-made="0"]'); page.fill('[data-why]', 'Result entered wrong'); page.click('[data-ok]'); page.wait_for_timeout(500)
    assert page.locator('.strike, [style*="line-through"]').count() > 0
    assert 'Result entered wrong' in page.inner_text('body')
    # undo needs a reason
    page.click('[data-act="undo"]'); page.wait_for_selector('[data-reason]'); page.click('[data-quick="Wrong bid entered"]'); page.click('[data-ok]'); page.wait_for_timeout(500)
    assert 'undone' in page.inner_text('body')
    page.screenshot(path=f'{OUT}/kt-3-history.png')
    # end game: only Modify remains
    page.click('[data-act="end"]'); page.wait_for_selector('.sheet.in .btn.danger'); page.click('.sheet.in .btn.danger'); page.wait_for_timeout(500)
    assert page.locator('[data-act="undo"]').count() == 0 and page.locator('[data-act="seats"]').count() == 0 and page.locator('[data-act="pause"]').count() == 0
    assert page.locator('[data-act="modify"]').count() >= 1

    # ---- Score Book, Rummy, Bhabhi ----
    new_room(page, 'scorebook', 3)
    page.click('[data-act="add"]'); page.wait_for_selector('[data-v]')
    for i, v in enumerate(['5', '3', '1']): page.locator('[data-v]').nth(i).fill(v)
    page.click('[data-ok]'); page.wait_for_timeout(400)
    page.locator('tr[data-edit="1"]').click(); page.wait_for_selector('[data-why]')
    page.locator('[data-v]').nth(0).fill('9'); assert page.locator('[data-ok]').is_disabled(); page.fill('[data-why]', 'typo'); page.click('.sheet.in [data-ok]'); page.wait_for_timeout(400)
    assert page.locator('.strike, [style*="line-through"]').count() > 0
    page.click('[data-act="undo"]'); page.wait_for_selector('[data-reason]'); page.fill('[data-reason]', 'wrong game'); page.click('[data-ok]'); page.wait_for_timeout(400)
    assert 'wrong game' in page.inner_text('body')
    page.screenshot(path=f'{OUT}/kt-4-scorebook.png')

    new_room(page, 'bhabhi', 3)
    page.click('[data-act="add"]'); page.wait_for_selector('[data-b]'); page.locator('[data-b]').first.click(); page.wait_for_timeout(400)
    page.locator('tr[data-edit="1"]').click(); page.wait_for_selector('[data-why]')
    page.locator('[data-b]').nth(1).click(); page.fill('[data-why]', 'wrong person'); page.click('.sheet.in [data-ok]'); page.wait_for_timeout(400)
    assert 'wrong person' in page.inner_text('body')

    new_room(page, 'rummy', 3)
    page.click('[data-act="add"]'); page.wait_for_selector('[data-k]')
    ids = page.locator('[data-k="win"]')
    page.locator('[data-k="win"]').nth(0).click(); page.locator('[data-k="drop"]').nth(1).click(); page.locator('[data-k="middle"]').nth(2).click()
    print('sheets', page.locator('.sheet.in').count(), page.locator('.sheet.in [data-ok]').count(), page.locator('.sheet.in [data-ok]').first.is_enabled())
    page.click('.sheet.in [data-ok]'); page.wait_for_timeout(400)
    print('ERR', errors)
    print('after', page.locator('.sheet.in').count(), page.inner_text('body')[:300].replace(chr(10),' | '))
    page.screenshot(path=f'{OUT}/kt-rummy.png')
    page.locator('tr[data-edit="1"]').click(); page.wait_for_selector('[data-why]')
    page.locator('[data-v]').nth(1).fill('30'); page.fill('[data-why]', 'recount'); page.click('.sheet.in [data-ok]'); page.wait_for_timeout(400)
    assert 'recount' in page.inner_text('body')
    print('ERRORS:', errors or 'none'); assert not errors
    b.close()
print('round-book games test passed')
