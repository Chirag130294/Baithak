"""Reactions: classic + card buddies, aimed with sender -> target names. Needs: node tools/serve.mjs 8099"""
import os
from playwright.sync_api import sync_playwright
from helpers import create_room
OUT = '/tmp/sh'
errors = []
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/opt/pw-browsers/chromium' if os.path.isfile('/opt/pw-browsers/chromium') else None)
    page = b.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True).new_page()
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto('http://localhost:8099/'); page.wait_for_selector('[data-guest]'); page.fill('[data-guestname]', 'vikas'); page.click('[data-guest]'); page.wait_for_selector('.gtile')
    page.click('a[href="#/new/kachuful"]'); page.wait_for_selector('[data-name="0"]')
    for i, n in enumerate(['vikas', 'JAYESH', 'meena', 'hetal']):
        if page.locator(f'[data-name="{i}"]').count() == 0: page.click('[data-add]')
        page.fill(f'[data-name="{i}"]', n)
    create_room(page); page.wait_for_selector('[data-roomscreen]'); page.wait_for_selector('.sheet.in'); page.keyboard.press('Escape'); page.wait_for_timeout(700)
    names = page.eval_on_selector_all('.prow .nm b, .lbchip b', 'els=>els.map(e=>e.textContent.trim())')
    print('names on screen:', names[:6])
    page.click('.rx-fab'); page.wait_for_selector('.rx-tray:not([hidden])'); page.wait_for_timeout(300)
    page.screenshot(path=f'{OUT}/rx-tray.png')
    page.click('.rx-c[data-aim="Jayesh"]')
    for k in ['kiss', 'angry', 'peek', 'confused', 'thinking', 'sleepy', 'walk', 'cheer']:
        if page.locator('.rx-tray[hidden]').count(): page.click('.rx-fab')
        page.click(f'.rx-b[data-k="{k}"]'); page.wait_for_timeout(1300)
        page.screenshot(path=f'{OUT}/rx-{k}.png')
        assert page.locator('.bd-ribbon').count() == 1, 'ribbon with who -> whom'
        print(k, '|', page.inner_text('.bd-ribbon'))
        page.wait_for_timeout(900)
    page.click('.rx-fab'); page.click('.rx-tabs [data-tab="classic"]'); page.click('.rx-b[data-k="hammer"]'); page.wait_for_timeout(600)
    print('classic', '|', page.inner_text('.bd-ribbon'))
    print('ERRORS:', errors or 'none')
