"""Two isolated browser devices against the real PostgreSQL score RPC via a test gateway."""
import os,shutil,threading
from http_fixture import serve
from playwright.sync_api import sync_playwright
server=serve();threading.Thread(target=server.serve_forever,daemon=True).start();url=f'http://127.0.0.1:{server.server_port}/'
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH',shutil.which('chromium')),headless=True,args=['--no-sandbox'])
 pages=[];contexts=[]
 for name,kills,coins in [('FrederikTest',5,123),('KimTest',6,777)]:
  c=browser.new_context();contexts.append(c)
  c.add_init_script("document.addEventListener('DOMContentLoaded',()=>{zombieCastle.audio.unlock=async()=>true;zombieCastle.audio.music=false;zombieCastle.audio.sfx=false;zombieCastle.renderer.draw=()=>{};})")
  page=c.new_page();page.goto(url);page.locator('#welcome-new').click();page.locator('#confirm-new').click()
  page.locator('#open-leaderboard').click();page.locator('#player-nickname').fill(name);page.locator('#save-nickname').click()
  page.wait_for_function('zombieCastle.board.profile.nickname===document.querySelector("#player-nickname").value')
  page.locator('#leaderboard-dialog .close-action').click();page.locator('#start-wave').click()
  page.wait_for_function('zombieCastle.game.savedExtras.onlineRun?.registered===true')
  page.evaluate('''({kills,coins})=>{const g=zombieCastle.game;g.coins=coins;g.kills=kills;g.hp=1;g.elapsed=10;g.remaining=0;g.zombies=[{id:1,kind:'silly',x:7.5,y:4.5,hp:43,maxHp:43,speed:0,damage:7,reward:9,slow:0,bite:0,next:null,flash:0}];g.update(.05);}''',{'kills':kills,'coins':coins})
  page.wait_for_function('document.querySelector("#online-result").textContent.includes("ranking: #")')
  assert page.evaluate('zombieCastle.game.coins')==coins
  pages.append(page)
 for page in pages:
  page.locator('#over-leaderboard').click()
  page.wait_for_function('document.querySelectorAll("#leaderboard-rows tr").length>=2')
  names=page.locator('#leaderboard-rows').inner_text();assert 'FrederikTest' in names and 'KimTest' in names
 assert pages[0].evaluate('zombieCastle.board.profile.deviceId')!=pages[1].evaluate('zombieCastle.board.profile.deviceId')
 assert pages[0].evaluate('zombieCastle.game.coins')==123 and pages[1].evaluate('zombieCastle.game.coins')==777
 print('PASS two isolated browser devices: separate anonymous identities and saved kingdoms; both see shared PostgreSQL leaderboard results',flush=True)
 for c in contexts:c.close()
 browser.close()
server.shutdown()
