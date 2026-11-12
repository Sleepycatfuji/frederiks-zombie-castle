"""Isolated Chromium persistence integration tests; never opens the live game's origin.
Run: python3 tests/browser-saves.py (requires Playwright and Chromium).
"""
import functools,http.server,json,os,shutil,threading,tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT/'dist')))
threading.Thread(target=server.serve_forever,daemon=True).start()
URL=f'http://127.0.0.1:{server.server_port}/'
def gameplay(value):
    state=json.loads(value) if isinstance(value,str) else dict(value)
    for key in ['localOnly','onlineRun']:state.pop(key,None)
    return state
def snapshot(page):return gameplay(page.evaluate('zombieCastle.game.exportSave()'))
def latest(page):return page.evaluate('zombieCastle.saves.inspect().records[0].payload')
with tempfile.TemporaryDirectory(prefix='zcd-browser-') as profile, sync_playwright() as p:
    # Rendering/audio are stubbed here to isolate persistence; their Node suites run separately.
    def launch():
        c=p.chromium.launch_persistent_context(profile,executable_path=os.environ.get('CHROMIUM_PATH',shutil.which('chromium')),headless=True,args=['--no-sandbox'])
        c.add_init_script("document.addEventListener('DOMContentLoaded',()=>{zombieCastle.audio.sfx=false;zombieCastle.audio.music=false;zombieCastle.audio.unlock=async()=>true;zombieCastle.renderer.draw=()=>{};})")
        # Persistent Chromium may restore old tabs alongside about:blank.
        for extra in c.pages[1:]:extra.close()
        return c
    context=launch();page=context.pages[0];errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(URL);page.wait_for_selector('#continue-dialog[open]')
    assert page.evaluate('localStorage.length')==0,'startup must not overwrite storage'
    # Populate all buildings and active-wave fields, including unknown extension data.
    legacy=page.evaluate('''()=>{const g=zombieCastle.game;g.creative=true;for(const [i,type] of Object.keys(ZCD.BUILDINGS).entries())g.place(type,i,1);g.cells[17].upgrades={level:3};g.savedExtras.resources={gems:12};g.coins=912;g.difficulty='hard';g.paused=false;g.startWave();for(let i=0;i<20;i++)g.update(.05);const s=g.snapshot();s.version=1;return JSON.stringify(s);}''')
    page.evaluate('(s)=>localStorage.setItem(ZCD.SAVE_KEY,s)',legacy)
    page.reload();page.locator('#continue-game').click()
    expected=gameplay(legacy);expected['version']=3
    assert snapshot(page)==expected,'legacy migration must preserve the battlefield exactly'
    assert page.evaluate('localStorage.getItem(ZCD.SAVE_KEY)')==legacy
    assert page.evaluate('zombieCastle.game.paused')
    print('PASS legacy v1 migration, extra upgrades/resources and read-only original entry')
    # Manual save asks before replacing an existing legacy/manual save.
    page.locator('#save').click();page.locator('#save-confirm-dialog[open]').wait_for();page.locator('#confirm-save').click()
    manual=page.evaluate('zombieCastle.saves.inspect().records.find(r=>r.slot==="manual").raw')
    page.locator('#difficulty').select_option('easy')
    page.wait_for_function('document.querySelector("#save-status").textContent==="Autosaved" && JSON.parse(zombieCastle.saves.inspect().records[0].payload).difficulty==="easy"')
    assert page.evaluate('zombieCastle.saves.inspect().records.find(r=>r.slot==="manual").raw')==manual
    # Resume and let real combat progress, then reload a precise checkpoint.
    page.locator('#pause').click();page.wait_for_timeout(1400);page.locator('#pause').click()
    page.evaluate('window.dispatchEvent(new Event("pagehide"))');before=snapshot(page)
    assert gameplay(latest(page))==before
    page.reload();page.locator('#continue-game').click();assert snapshot(page)==before
    print('PASS active-wave refresh; independent autosave/manual slots')
    context.close();context=launch();page=context.pages[0];page.goto(URL);page.locator('#continue-game').click();assert snapshot(page)==before
    print('PASS closing and reopening Chromium with the same disk profile')
    # File transfer into a wholly separate browser storage partition.
    with page.expect_download() as d:page.locator('#export-save').click()
    raw=Path(d.value.path()).read_bytes()
    context.close()
    other=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH',shutil.which('chromium')),headless=True,args=['--no-sandbox'])
    other_context=other.new_context();other_context.add_init_script("document.addEventListener('DOMContentLoaded',()=>{zombieCastle.audio.sfx=false;zombieCastle.audio.music=false;zombieCastle.audio.unlock=async()=>true;zombieCastle.renderer.draw=()=>{};})");foreign=other_context.new_page();foreign.set_viewport_size({'width':390,'height':844});foreign.goto(URL)
    foreign.locator('#save-file').set_input_files({'name':'kingdom.json','mimeType':'application/json','buffer':raw})
    foreign.locator('#confirm-import').click();assert snapshot(foreign)==before
    foreign.reload();foreign.locator('#continue-game').click();assert snapshot(foreign)==before
    print('PASS mobile-sized import/export across isolated browser storage')
    other.close();context=launch();page=context.pages[0];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(URL);page.locator('#continue-game').click()
    # Valid JSON tampering and truncation: fallback remains loadable and source bytes remain.
    older=page.evaluate('''()=>{const s=zombieCastle.saves.inspect();const newest=s.records[0];const next=s.records[1];localStorage.setItem(newest.key,'broken record');return next.payload;}''')
    page.reload();assert 'damaged' in page.locator('#continue-summary').inner_text();page.locator('#continue-game').click()
    assert snapshot(page)==gameplay(older)
    page.wait_for_function('Object.keys(localStorage).some(k=>k.includes("recovery.") && localStorage.getItem(k)==="broken record")')
    print('PASS corrupted latest generation recovery and quarantine')
    # Failed writes never claim success and leave durable records intact.
    page.evaluate('''()=>{window.originalWrite=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k.startsWith(ZCD.SAVE_PREFIX))throw new DOMException('Quota exceeded','QuotaExceededError');return originalWrite.call(this,k,v);};}''')
    page.locator('#difficulty').select_option('hard' if snapshot(page)['difficulty']!='hard' else 'easy')
    page.wait_for_function('document.querySelector("#save-status").textContent.startsWith("Save failed")')
    assert 'Autosaved' not in page.locator('#save-status').inner_text()
    page.evaluate('()=>{Storage.prototype.setItem=window.originalWrite;}')
    print('PASS failed storage writes never show Saved')
    # New game and overwrite both require confirmation; permanent checkpoint survives autosaves.
    page.locator('#new-game').click();prior=snapshot(page);assert snapshot(page)==prior
    page.locator('#new-dialog .close-action').click();assert snapshot(page)==prior
    page.locator('#new-game').click();page.locator('#confirm-new').click()
    assert page.evaluate('zombieCastle.saves.inspect().records.some(r=>r.slot==="checkpoint" && JSON.parse(r.payload).coins===912)')
    assert page.evaluate('localStorage.getItem(ZCD.SAVE_KEY)')==legacy
    page.locator('#save').click();assert page.locator('#save-confirm-dialog').evaluate('(d)=>d.open')
    assert page.evaluate('zombieCastle.saves.inspect().records.find(r=>r.slot==="manual").raw')==manual
    print('PASS new-game and manual-overwrite confirmations; original and manual saves preserved')
    page.locator('#save-confirm-dialog .close-action').click()
    second=context.new_page();second.goto(URL);second.locator('#continue-game').click()
    second.wait_for_function('zombieCastle.saves.readOnly && zombieCastle.saves.readOnly.includes("Another game tab")')
    durable=page.evaluate('zombieCastle.saves.inspect().records[0].raw')
    second.locator('#difficulty').select_option('hard')
    second.wait_for_timeout(150)
    assert page.evaluate('zombieCastle.saves.inspect().records[0].raw')==durable
    second.close()
    print('PASS second tab cannot overwrite the active tab’s progress')
    assert not errors,errors
    context.close()
server.shutdown()
