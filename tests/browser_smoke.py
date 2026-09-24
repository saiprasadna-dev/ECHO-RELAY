"""Full UI playthrough using two isolated browsers. Only test your own deployment.

Start npm start (local adapter) or npm run cloudflare:dev (workerd), then:
  python -m pip install -r tests/requirements.txt
  python -m playwright install chromium
  python tests/browser_smoke.py http://127.0.0.1:8787
Pass your own published Worker URL to exercise production instead.
This script is supplied for release verification; see docs/TESTING.md for results.
"""
import os
import re
import sys
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright, expect

def walk(page, station):
    page.locator(f'.travel-spot[data-station="{station}"]').click()
    expect(page.locator(f'.travel-spot.is-near[data-station="{station}"]')).to_be_visible()


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
            assert a.locator('#water-grow').count() == 0, 'Controls should be hidden away from an object'
            walk(a, 'wheel')
            a.locator('#water-grow').click()
            walk(b, 'roots')
            expect(b.locator('#controls')).to_contain_text('Grown')
            b.locator('#anchor-action').click()
            expect(b.locator('#anchor-action')).to_contain_text('grown')
            a.locator('#water-drain').click()
            b.reload()
            expect(b.locator('#anchor-action')).to_contain_text('grown')
            walk(b, 'gate')
            expect(b.locator('#cross')).to_be_enabled()
            b.screenshot(path=str(out / 'root-bridge-mobile.png'), full_page=True)
            b.locator('#cross').click()
            for page in (a, b):
                expect(page.locator('#game-heading')).to_contain_text('The Clockwork Lift')
            walk(b, 'blueprint')
            clue = b.locator('[data-testid="gear-clue"]')
            expect(clue).to_be_visible()
            assert a.locator('[data-testid="gear-clue"]').count() == 0
            shape = re.search(r'circle|triangle|diamond', clue.inner_text().lower()).group()
            walk(a, 'bearing')
            a.locator(f'#gear-{shape}').click()
            walk(b, 'drive')
            expect(b.locator('#controls')).to_contain_text('Working')
            b.locator('#anchor-action').click()
            expect(b.locator('#anchor-action')).to_contain_text('working')
            walk(a, 'power')
            a.locator('#power-lift').click()
            walk(b, 'lift')
            expect(b.locator('#ride')).to_be_enabled()
            b.locator('#ride').click()
            for page in (a, b):
                expect(page.locator('#game-heading')).to_contain_text('The Last Light')
            walk(b, 'stars')
            stars = b.locator('[data-testid="constellation-clue"]')
            expect(stars).to_be_visible()
            assert a.locator('[data-testid="constellation-clue"]').count() == 0
            symbols = re.findall(r'sun|moon|star|wave', stars.inner_text().lower())
            assert len(symbols) == 3
            walk(a, 'rings')
            for index, symbol in enumerate(symbols):
                a.locator(f'#ring-{symbol}-{index}').click()
            walk(b, 'lens')
            expect(b.locator('#controls')).to_contain_text('Charged')
            b.locator('#anchor-action').click()
            expect(b.locator('#anchor-action')).to_contain_text('charged')
            walk(a, 'beam')
            a.locator('#beam-portal').click()
            walk(a, 'portal')
            walk(b, 'portal')
            expect(a.locator('#pulse')).to_be_enabled()
            expect(b.locator('#pulse')).to_be_enabled()
            a.locator('#pulse').click()
            expect(a.locator('#pulse')).to_contain_text('waiting')
            b.locator('#pulse').click()
            expect(b.locator('#game-heading')).to_contain_text('The Moonlit Canal')
            walk(b, 'chart')
            tide = re.search(r'Mark ([123])', b.locator('[data-testid="tide-clue"]').inner_text()).group(1)
            walk(a, 'sluice')
            a.locator(f'#tide-{tide}').click()
            walk(b, 'boat')
            expect(b.locator('#controls')).to_contain_text('Afloat')
            b.locator('#anchor-action').click()
            walk(a, 'mooring')
            a.locator('#mooring-release').click()
            walk(b, 'jetty')
            b.locator('#sail').click()
            expect(b.locator('#game-heading')).to_contain_text('The Storm Tower')
            walk(b, 'map')
            direction = re.search(r'north|east|west', b.locator('[data-testid="heading-clue"]').inner_text().lower()).group()
            walk(a, 'compass')
            a.locator(f'#heading-{direction}').click()
            walk(b, 'beacon')
            expect(b.locator('#controls')).to_contain_text('Lit')
            b.locator('#anchor-action').click()
            walk(a, 'shutter')
            a.locator('#shutter-open').click()
            walk(b, 'skybridge')
            b.locator('#ascend').click()
            for page in (a, b):
                expect(page.locator('#game-heading')).to_contain_text('The Reunion Garden')
                expect(page.locator('.companion-traveller')).to_be_visible()
                walk(page, 'meeting')
                page.locator('#meet').click()
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
            print('PASS: two isolated browser sessions completed all six destinations, walking/proximity, refresh recovery, private UI clues, reunion and role-swapped replay.')
            print(f'Actual target: {base}. This is not a physical-device or load test.')
        finally:
            browser.close()


if __name__ == '__main__':
    main()
