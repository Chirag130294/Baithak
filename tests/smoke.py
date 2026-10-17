"""Phone-size browser test. Run: python3 tests/smoke.py [base_url] [screenshot_dir]
Needs Playwright for Python and a local server (node tools/serve.mjs)."""
import sys, re, json, os
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8099/'
OUT = sys.argv[2] if len(sys.argv) > 2 else '/tmp/shots'
os.makedirs(OUT, exist_ok=True)
errors = []

def shot(page, name):
    page.screenshot(path=f'{OUT}/{name}.png')

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/opt/pw-browsers/chromium' if os.path.exists('/opt/pw-browsers/chromium') and os.path.isfile('/opt/pw-browsers/chromium') else None)
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, has_touch=True, is_mobile=True)
    page = ctx.new_page()
    page.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
    page.on('console', lambda m: errors.append('console: ' + m.text) if m.type == 'error' and 'fonts.g' not in m.text and 'ERR_' not in m.text and 'Failed to load resource' not in m.text else None)

    page.goto(BASE)
    page.wait_for_selector('[data-guest]')
    shot(page, '01-login')
    page.fill('[data-guestname]', 'Vikas')
    page.click('[data-guest]')
    page.wait_for_selector('.gtile')
    shot(page, '02-home')
    assert page.locator('.gtile:not(.dashed)').count() == 5, 'expected 5 game tiles'

    page.click('a[href="#/new/kachuful"]')
    page.wait_for_selector('[data-name="0"]')
    for i, n in enumerate(['Vikas', 'Jayesh', 'Meena', 'Hetal', 'Kiran']):
        if page.locator(f'[data-name="{i}"]').count() == 0:
            page.click('[data-add]')
        page.fill(f'[data-name="{i}"]', n)
    shot(page, '03-setup')
    page.click('[data-create]')
    page.wait_for_selector('[data-roomscreen]')
    page.wait_for_selector('.sheet.in')   # invite sheet opens for a new room
    code = page.inner_text('.sheet.in div[style*="letter-spacing"]').strip()
    assert re.match(r'^KF-\d{4}$', code), code
    shot(page, '04-invite')
    page.click('.sheet.in [data-close]') if page.locator('.sheet.in [data-close]').count() else page.keyboard.press('Escape')
    page.wait_for_timeout(400)
    shot(page, '05-bid-start')

    def bid_round():
        # everyone bids 0 except the first bidder who bids 1 when the dealer would otherwise match the cards
        n_players = page.locator('[data-flip^="row-"]').count()
        for _ in range(n_players):
            btn = page.locator('[data-inc]:not([disabled])').first
            btn.click()
        # fix problem if lock disabled: raise first bidder
        if page.locator('[data-act="lock"][disabled]').count():
            page.locator('[data-inc]').first.click()
        page.wait_for_timeout(100)

    # Round 1: 1 card
    rows = page.locator('[data-flip^="row-"]')
    assert rows.count() == 5
    first_order = [rows.nth(i).get_attribute('data-flip') for i in range(5)]
    for i in range(5):
        rows.nth(i).locator('[data-inc]').click()   # each taps + once -> bid 0
    page.wait_for_timeout(150)
    # dealer (last) cannot bid 1 if others total 0 -> check lock enabled
    lock = page.locator('[data-act="lock"]')
    assert lock.is_enabled(), 'lock should be enabled when total != cards'
    shot(page, '06-bids-entered')
    # make the first bidder bid 1 so dealer's value is forbidden = 0, then check dealer stepper skips
    rows.nth(0).locator('[data-inc]').click()
    page.wait_for_timeout(100)
    dealer_text = rows.nth(4).inner_text()
    assert 'cannot bid' in dealer_text, dealer_text
    shot(page, '07-dealer-forbidden')
    # dealer bids 1 (allowed)
    rows.nth(4).locator('[data-inc]').click()
    page.wait_for_timeout(100)
    assert lock.is_enabled()
    lock.click()
    page.wait_for_timeout(200)
    # tricks: first bidder wins the only trick
    page.locator('[data-flip^="row-"]').nth(0).locator('[data-inc]').click()
    shot(page, '08-tricks')
    page.click('[data-act="save"]')
    page.wait_for_timeout(900)
    shot(page, '09-round2')
    second_order = [page.locator('[data-flip^="row-"]').nth(i).get_attribute('data-flip') for i in range(5)]
    assert second_order == first_order[1:] + first_order[:1], ('dealer should rotate to last', first_order, second_order)
    assert 'Round 2' in page.inner_text('.card.felt')

    # leaderboard visible
    assert page.locator('[data-flip^="lb-"]').count() == 5

    # viewer: same browser, different user id
    viewer = ctx.new_page()
    viewer.on('pageerror', lambda e: errors.append('viewer pageerror: ' + str(e)))
    viewer.goto(BASE)
    viewer.wait_for_selector('[data-guest]') if viewer.locator('[data-guest]').count() else None
    viewer.evaluate("() => { const u = JSON.parse(localStorage.getItem('baithak:user')); u.uid = 'viewer1'; u.name = 'Friend'; localStorage.setItem('baithak:user', JSON.stringify(u)); }")
    viewer.goto(BASE + '#/r/' + code)
    viewer.reload()
    viewer.wait_for_selector('[data-roomscreen] .card.felt')
    assert viewer.locator('[data-inc]').count() == 0, 'viewer must not have bid buttons'
    assert 'Round 2' in viewer.inner_text('.card.felt')
    shot(viewer, '10-viewer')
    # live update: host starts bidding round 2, viewer sees bid appear
    page.locator('[data-flip^="row-"]').nth(0).locator('[data-inc]').click()
    viewer.wait_for_function("() => document.querySelectorAll('[data-flip^=\"row-\"] [data-anim^=\"vbid-\"]').length > 0")
    viewer.wait_for_timeout(300)
    vb = viewer.locator('[data-anim^="vbid-"]').first.inner_text()
    assert vb == '0', vb
    shot(viewer, '11-viewer-live')
    # pause shows on viewer
    page.click('[data-act="pause"]')
    viewer.wait_for_selector('text=paused by the host')
    page.click('[data-act="pause"]')
    viewer.close()

    # other games open
    for gid, prefix in [('scorebook', 'SB'), ('rummy', 'RM'), ('teenpatti', 'TP'), ('bhabhi', 'BH')]:
        page.goto(BASE + '#/new/' + gid)
        page.wait_for_selector('[data-name="0"]')
        page.fill('[data-name="1"]', 'Jayesh'); page.fill('[data-name="2"]', 'Meena')
        page.click('[data-create]')
        page.wait_for_selector('[data-roomscreen] .actionbar')
        page.keyboard.press('Escape')
        page.wait_for_timeout(350)
        shot(page, f'12-{gid}')

    # rooms + profile tabs
    page.goto(BASE + '#/rooms'); page.wait_for_selector('.card')
    shot(page, '13-rooms')
    page.goto(BASE + '#/me'); page.wait_for_selector('[data-signout]')
    shot(page, '14-profile')

    # Gujarati
    page.click('[data-lang="gu"]'); page.wait_for_timeout(300)
    shot(page, '15-gujarati')
    b.close()

print('ERRORS:', json.dumps(errors, indent=1) if errors else 'none')
sys.exit(1 if errors else 0)
