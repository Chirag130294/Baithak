"""Phone test for the room-code guard and private rooms (demo mode).
Run: python3 tests/guard.py [base_url]"""
import sys, re, os
from playwright.sync_api import sync_playwright
from helpers import create_room

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8099/'
errors = []

def new_room(page, pin=None):
    page.click('a[href="#/new/kachuful"]')
    page.wait_for_selector('[data-name="0"]')
    for i, n in enumerate(['Vikas', 'Jayesh', 'Meena']):
        if page.locator(f'[data-name="{i}"]').count() == 0:
            page.click('[data-add]')
        page.fill(f'[data-name="{i}"]', n)
    for _ in range(4):
        if page.locator('[data-create]').count(): break
        page.click('[data-next]'); page.wait_for_timeout(120)
    if pin is not None:
        page.fill('[data-pin]', pin)
    page.click('[data-create]')
    page.wait_for_selector('[data-roomscreen]')
    page.wait_for_selector('.sheet.in')
    return page.inner_text('.sheet.in .invcode').strip()

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True)
    page = ctx.new_page()
    page.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
    page.goto(BASE)
    page.wait_for_selector('[data-guest]')
    page.fill('[data-guestname]', 'Vikas'); page.click('[data-guest]')
    page.wait_for_selector('.gtile')

    # 1. a new room gets a long code, and a PIN room shows its PIN to the host
    code = new_room(page)
    assert re.match(r'^KF-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$', code), code
    page.keyboard.press('Escape'); page.wait_for_timeout(300)
    page.goto(BASE + '#/'); page.wait_for_selector('.gtile')
    pcode = new_room(page, pin='4821')
    assert pcode != code
    assert '4821' in page.inner_text('.sheet.in'), 'host sees the PIN in the invite sheet'
    page.keyboard.press('Escape'); page.wait_for_timeout(300)

    # 2. a stranger (fresh storage, same demo database is per browser, so simulate by clearing the host + unlock flags)
    page.evaluate("""() => { localStorage.removeItem('baithak:user'); Object.keys(localStorage).filter(k => k.startsWith('baithak:unlock:')).forEach(k => localStorage.removeItem(k)); }""")
    page.goto(BASE + '#/r/' + pcode); page.reload()
    page.wait_for_selector('[data-code]')
    assert 'PIN' in page.inner_text('body')
    page.fill('[data-code]', '1111'); page.click('[data-join]')
    page.wait_for_selector('[data-err]:not([hidden])')
    page.fill('[data-code]', '4821'); page.click('[data-join]')
    page.wait_for_selector('[data-roomscreen]')   # right PIN opens the room

    # 3. wrong codes: 3 in a row lock the join box for about a minute
    page.evaluate("localStorage.removeItem('baithak:guard')")
    page.goto(BASE + '#/'); page.reload()
    page.wait_for_selector('[data-code]')
    for c in ['nonsense', 'KF-4821X', 'zz']:
        page.fill('[data-code]', c); page.click('[data-join]'); page.wait_for_timeout(150)
    page.wait_for_selector('[data-lockmsg]:not([hidden])')
    assert page.locator('[data-join]').is_disabled()
    assert re.search(r'0:[0-5]\d|1:00', page.inner_text('[data-lockmsg]')), page.inner_text('[data-lockmsg]')

    # 4. while locked, an unknown room code in the address bar shows the waiting screen, a known room still opens
    page.goto(BASE + '#/r/KF-ABCD-EFGH'); page.reload()
    page.wait_for_selector('[data-count]')
    page.goto(BASE + '#/r/' + code); page.reload()
    page.wait_for_selector('[data-roomscreen]')

    # 5. the lock really ends: fake the clock forward and the box comes back
    page.evaluate("""() => { const g = JSON.parse(localStorage.getItem('baithak:guard')); g.until = Date.now() - 1; localStorage.setItem('baithak:guard', JSON.stringify(g)); }""")
    page.goto(BASE + '#/'); page.reload()
    page.wait_for_selector('[data-code]')
    assert not page.locator('[data-join]').is_disabled()
    b.close()

print('PAGE ERRORS:', errors or 'none')
assert not errors, errors
print('guard.py OK')
