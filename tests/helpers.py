"""Shared bits for the phone tests."""
def create_room(page):
    """Setup is a short flow now (players, rules, go). Press Next until the last step, then create."""
    for _ in range(4):
        if page.locator('[data-create]').count():
            break
        page.click('[data-next]')
        page.wait_for_timeout(120)
    page.click('[data-create]')
