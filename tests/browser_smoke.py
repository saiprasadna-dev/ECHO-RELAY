"""Full UI playthrough using two isolated browsers. Only test your own deployment.

Start npm start (local adapter) or npm run cloudflare:dev (workerd), then:
  python -m pip install -r tests/requirements.txt
  python -m playwright install chromium
  python tests/browser_smoke.py http://127.0.0.1:8787
Pass your own published Worker URL to exercise production instead.
This script is supplied for release verification; see docs/TESTING.md for results.
"""
import os
import sys
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright, expect


def main():
    base = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8787').rstrip('/')
    target = urlsplit(base)
    if target.scheme not in ('http', 'https') or not target.netloc or target.path or target.query or target.fragment:
        raise SystemExit('Supply the game origin only, e.g. http://127.0.0.1:8787')
    out = Path(__file__).resolve().parents[1] / 'test-results'
    out.mkdir(exist_ok=True)
    errors = []
    with sync_playwright() as p:
        launch = {'headless': True}
        if os.environ.get('BROWSER_EXECUTABLE'):
            launch['executable_path'] = os.environ['BROWSER_EXECUTABLE']
        browser = p.chromium.launch(**launch)
        try:
            desktop = browser.new_context(viewport={'width': 1440, 'height': 1050}, reduced_motion='reduce')
            mobile = browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, reduced_motion='reduce')
            a, b = desktop.new_page(), mobile.new_page()
            for page in (a, b):
                page.set_default_timeout(20000)
                page.on('pageerror', lambda error: errors.append(str(error)))
            a.goto(base)
            expect(a.locator('.hero h1')).to_contain_text('ECHO')
            a.screenshot(path=str(out / 'home-desktop.png'), full_page=True)
            a.locator('#nickname').fill('Past traveller')
            a.locator('#entry-form button[type=submit]').click()
            expect(a.locator('[data-testid="room-code"]')).to_be_visible()
            code = a.locator('[data-testid="room-code"]').inner_text()
            b.goto(f'{base}/?room={code}')
            b.locator('#nickname').fill('Future traveller')
            b.locator('#entry-form button[type=submit]').click()
            expect(b.locator('#ready')).to_be_enabled()
            a.locator('#ready').click()
            b.locator('#ready').click()
            for page in (a, b):
                expect(page.locator('#game-heading')).to_contain_text('The Root Bridge')
            a.locator('#water-grow').click()
            expect(b.locator('#controls')).to_contain_text('Grown')
            b.locator('#anchor-action').click()
            expect(b.locator('#anchor-action')).to_contain_text('grown')
            a.locator('#water-drain').click()
            expect(b.locator('#cross')).to_be_enabled()
            b.reload()
            expect(b.locator('#anchor-action')).to_contain_text('grown')
            expect(b.locator('#cross')).to_be_enabled()
            b.screenshot(path=str(out / 'root-bridge-mobile.png'), full_page=True)
            b.locator('#cross').click()
            for page in (a, b):
                expect(page.locator('#game-heading')).to_contain_text('The Clockwork Lift')
            clue = b.locator('[data-testid="gear-clue"]')
            expect(clue).to_be_visible()
            assert a.locator('[data-testid="gear-clue"]').count() == 0
            a.locator(f'#gear-{clue.get_attribute("data-shape")}').click()
            expect(b.locator('#controls')).to_contain_text('Working')
            b.locator('#anchor-action').click()
            expect(b.locator('#anchor-action')).to_contain_text('working')
            a.locator('#power-lift').click()
            expect(b.locator('#ride')).to_be_enabled()
            b.locator('#ride').click()
            for page in (a, b):
                expect(page.locator('#game-heading')).to_contain_text('The Last Light')
            stars = b.locator('[data-testid="constellation-clue"]')
            expect(stars).to_be_visible()
            assert a.locator('[data-testid="constellation-clue"]').count() == 0
            for index, symbol in enumerate(stars.get_attribute('data-target').split(',')):
                a.locator(f'#ring-{symbol}-{index}').click()
            expect(b.locator('#controls')).to_contain_text('Charged')
            b.locator('#anchor-action').click()
            expect(b.locator('#anchor-action')).to_contain_text('charged')
            a.locator('#beam-portal').click()
            expect(a.locator('#pulse')).to_be_enabled()
            expect(b.locator('#pulse')).to_be_enabled()
            a.locator('#pulse').click()
            expect(a.locator('#pulse')).to_contain_text('waiting')
            b.locator('#pulse').click()
            for page in (a, b):
                expect(page.locator('.ending h1')).to_contain_text('You brought each other home.')
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), 'Horizontal overflow'
            a.screenshot(path=str(out / 'ending-desktop.png'), full_page=True)
            a.locator('[data-action="replay"]').click()
            b.locator('[data-action="proposal-accept"]').click()
            for page in (a, b):
                expect(page.locator('#ready')).to_be_enabled()
            expect(a.locator('.player-slot.future')).to_contain_text('Past traveller · You')
            expect(b.locator('.player-slot.past')).to_contain_text('Future traveller · You')
            assert not errors, f'Browser errors: {errors}'
            print('PASS: two isolated browser sessions completed all chambers, refresh recovery, private UI clues, ending and role-swapped replay.')
            print(f'Actual target: {base}. This is not a physical-device or load test.')
        finally:
            browser.close()


if __name__ == '__main__':
    main()
