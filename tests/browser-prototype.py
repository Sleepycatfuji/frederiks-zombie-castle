"""Real Chromium controls/render/audio checks at desktop and touch-phone sizes."""
import functools,http.server,json,os,shutil,threading
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT/'dist')))
threading.Thread(target=server.serve_forever,daemon=True).start();url=f'http://127.0.0.1:{server.server_port}/'
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH',shutil.which('chromium')),headless=True,args=['--no-sandbox'])
 for mobile in [False,True]:
  ctx=browser.new_context(viewport={'width':390 if mobile else 1440,'height':844 if mobile else 1000},has_touch=mobile,is_mobile=mobile,reduced_motion='reduce');page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(url);page.locator('#welcome-new').click();page.locator('#confirm-new').click()
  assert page.title().startswith("Frederik's Castle Defense")
  # Original engine creates an audible signal after the first user action.
  signal=page.evaluate('''async()=>{const a=zombieCastle.audio;await a.unlock();const analyser=a.ctx.createAnalyser();a.musicBus.connect(analyser);a.fxBus.connect(analyser);a.play('place');await new Promise(r=>setTimeout(r,140));const samples=new Float32Array(analyser.fftSize);analyser.getFloatTimeDomainData(samples);return Math.max(...samples.map(Math.abs));}''')
  assert signal>0
  page.locator('#music').click();assert page.locator('#music').get_attribute('aria-pressed')=='false'
  page.locator('#sfx').click();assert page.locator('#sfx').get_attribute('aria-pressed')=='false'
  cv=page.locator('#game');cv.scroll_into_view_if_needed();box=cv.bounding_box()
  def xy(x,y):return {'x':box['x']+(x+.5)*box['width']/15,'y':box['y']+(y+.5)*box['height']/10}
  # Drag uses actual mouse events or touch PointerEvents through the browser.
  if mobile:
   start=xy(1,8);end=xy(4,8)
   cdp=ctx.new_cdp_session(page)
   cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[start]})
   for i in range(1,7):cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':start['x']+(end['x']-start['x'])*i/6,'y':start['y']}]})
   cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
  else:
   a=xy(1,8);b=xy(4,8);page.mouse.move(a['x'],a['y']);page.mouse.down();page.mouse.move(b['x'],b['y'],steps=8);page.mouse.up()
  assert page.evaluate('[1,2,3,4].every(x=>zombieCastle.game.get(x,8)?.type==="wood")')
  coins=page.evaluate('zombieCastle.game.coins');assert coins==360
  page.locator('#open-inventory').click();assert page.locator('#inventory-catalogue h3').all_text_contents()==['Defense','Attack','Resources','Special']
  page.get_by_role('button',name='Remove favorite Wooden wall',exact=True).click()
  assert page.evaluate('zombieCastle.game.get(1,8).type')=='wood'
  assert page.evaluate('zombieCastle.toolbar.items.includes("wood")') is False
  page.get_by_role('button',name='Add Wooden wall to toolbar',exact=True).click()
  page.get_by_role('button',name='Move earlier Wooden wall',exact=True).click()
  favorites=page.evaluate('[...zombieCastle.toolbar.items]');assert favorites[6]=='wood';assert page.evaluate('zombieCastle.game.coins')==coins
  page.locator('#inventory-dialog .close-action').click()
  # Force a legitimate end-of-wave state to test real-time countdown/UI paths.
  page.evaluate('()=>{const g=zombieCastle.game;g.wave=5;g.phase="wave";g.remaining=0;g.zombies=[];g.paused=false;g.finishWave();}')
  page.wait_for_function('document.querySelector("#phase-badge").textContent.includes("BUILDING LOCKED")')
  assert page.locator('#start-wave span').inner_text()=='Start Wave Early'
  before=page.evaluate('JSON.stringify(zombieCastle.game.cells)');assert page.locator('[data-building="wood"]').is_disabled()
  page.locator('#pause').click();remaining=page.evaluate('zombieCastle.game.countdown');page.wait_for_timeout(300);assert page.evaluate('zombieCastle.game.countdown')==remaining
  page.locator('#open-inventory').click();page.get_by_role('button',name='Move earlier Wooden wall',exact=True).click();page.locator('#inventory-dialog .close-action').click();assert page.evaluate('zombieCastle.game.paused')
  page.evaluate('window.dispatchEvent(new Event("pagehide"))');page.reload();assert page.evaluate('zombieCastle.toolbar.items[5]')=='wood'
  page.locator('#continue-game').click();assert page.evaluate('zombieCastle.game.phase')=='countdown';assert page.evaluate('zombieCastle.game.paused');assert page.evaluate('JSON.stringify(zombieCastle.game.cells)')==before
  page.locator('#pause').click();page.locator('#start-wave').click();assert page.evaluate('zombieCastle.game.wave')==6;assert page.evaluate('zombieCastle.game.phase')=='wave';assert page.locator('[data-building="wood"]').is_enabled()
  page.wait_for_function('document.querySelector("#world-name").textContent.includes("Amber Woods")')
  # Another countdown must advance on its own without clicking any level control.
  page.evaluate('()=>{const g=zombieCastle.game;g.remaining=0;g.zombies=[];g.finishWave();g.countdown=.2;}')
  page.wait_for_function('zombieCastle.game.wave===7 && zombieCastle.game.phase==="wave"')
  # Retirement affects construction menus, not previously placed buildings.
  page.reload();page.locator('#continue-game').click()
  assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
  assert not errors,errors
  page.screenshot(path=f'/workspace/work/family-v2-{"phone" if mobile else "desktop"}.png',full_page=True)
  print('PASS', 'touch-phone' if mobile else 'desktop', 'drag, cost, inventory categories/favorites/reordering, countdown lock/pause/early/auto, save reload, world progression, original audio controls, no JS errors',flush=True)
  ctx.close()
 browser.close()
server.shutdown()
