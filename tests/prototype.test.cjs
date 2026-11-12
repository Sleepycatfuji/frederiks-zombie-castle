const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto'),path=require('node:path');
function setup(){const c={window:{}};vm.createContext(c);for(const f of ['data','engine','saves','native-store'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../dist/js/'+f+'.js'),'utf8'),c);const Z=c.window.ZCD;return {Z,g:new Z.Game({starter:false,random:()=>.5})};}
function tick(g,n){for(let i=0;i<n*100;i++)g.update(.01);}
function countdown(g){g.wave=1;g.phase='wave';g.remaining=0;g.zombies=[];g.finishWave();}
test('initial preparation is unlimited; victory starts exactly eight real simulation seconds regardless of speed',()=>{
 const {g}=setup();tick(g,20);assert.equal(g.wave,0);assert.equal(g.phase,'build');g.startWave();g.remaining=0;g.finishWave();assert.equal(g.countdown,8);g.speed=2;tick(g,7.99);assert.equal(g.phase,'countdown');g.update(.01);assert.equal(g.wave,2);assert.equal(g.phase,'wave');assert.equal(g.countdown,0);assert.equal(g.remaining,12);
});
test('pause freezes countdown; starting early advances once and restores building',()=>{
 const {g}=setup();countdown(g);g.paused=true;tick(g,10);assert.equal(g.countdown,8);assert.equal(g.startWave(),false);g.paused=false;assert.equal(g.startWave(),true);assert.equal(g.startWave(),false);assert.equal(g.place('wood',0,0).ok,true);
});
test('all structure modifications are rejected throughout countdown without spending coins or changing state',()=>{
 const {g}=setup();g.creative=true;g.place('archer',0,0);g.place('bridge',1,0);countdown(g);const before=g.exportSave();for(const action of [()=>g.place('wood',2,0),()=>g.remove(0,0),()=>g.toggleBridge(1,0),()=>g.upgrade(0,0)]){assert.equal(action().ok,false);assert.equal(g.exportSave(),before);}g.startWave();assert.equal(g.upgrade(0,0).ok,true);assert.equal(g.remove(1,0).ok,true);
});
test('automatic progression crosses a world milestone without clearing kingdom, coins, difficulty or upgrades',()=>{
 const {g}=setup();g.creative=true;g.place('archer',0,0);g.upgrade(0,0);g.difficulty='hard';g.wave=5;g.phase='wave';g.finishWave();const cells=JSON.stringify(g.cells),coins=g.coins;tick(g,8);assert.equal(g.wave,6);assert.equal(g.world.name,'Amber Woods');assert.equal(JSON.stringify(g.cells),cells);assert.equal(g.coins,coins);assert.equal(g.difficulty,'hard');g.spawn();assert.ok(g.zombies[0].maxHp>43);
});
test('countdown, active wave and high scores round trip exactly',()=>{
 for(const phase of ['countdown','wave']){const {Z,g}=setup();countdown(g);if(phase==='wave'){g.startWave();tick(g,.5);}else tick(g,2.25);const raw=g.exportSave(),copy=new Z.Game();assert.equal(copy.importSave(raw).ok,true);assert.equal(copy.exportSave(),raw);if(phase==='countdown'){tick(copy,5.75);assert.equal(copy.wave,2);}}
});
test('v1 and P0 v2 saved intermissions migrate into countdown; optional upgrades and resources are retained',()=>{
 const {Z,g}=setup();g.place('archer',0,0);g.get(0,0).upgrades={skyWatch:true,other:2};g.wave=8;g.savedExtras.resources={gems:7};for(const version of [1,2]){const old=g.snapshot();old.version=version;delete old.countdown;delete old.highScores;const raw=JSON.stringify(old),copy=new Z.Game();assert.equal(copy.importSave(raw).ok,true);assert.equal(copy.phase,'countdown');assert.equal(copy.countdown,8);assert.equal(copy.coins,g.coins);assert.equal(JSON.stringify(copy.cells),JSON.stringify(g.cells));assert.equal(copy.savedExtras.resources.gems,7);assert.equal(JSON.stringify(old),raw);}
});
test('new invalid countdown data leaves the current battlefield intact',()=>{
 const {g}=setup();const before=g.exportSave();for(const extra of [{phase:'countdown',wave:1,countdown:9},{countdown:-1},{phase:'countdown',wave:1,countdown:0},{highScores:{x:-1}}]){assert.equal(g.importSave(JSON.stringify({...g.snapshot(),...extra})).ok,false);assert.equal(g.exportSave(),before);}
});
test('placement limits protect the economy while grandfathering all imported structures',()=>{
 const {Z,g}=setup();g.creative=true;for(let i=0;i<4;i++)assert.equal(g.place('mine',i,0).ok,true);assert.equal(g.place('mine',4,0).ok,false);const old=g.snapshot();old.cells[4]=g.makeBuilding('mine');assert.equal(g.importSave(JSON.stringify(old)).ok,true);assert.equal(g.cells.filter(b=>b?.type==='mine').length,5);assert.equal(g.place('mine',5,0).ok,false);assert.deepEqual(Object.values(Z.BUILDINGS).map(b=>b.cost),[15,35,65,110,90,80,20,40]);
});
test('flyers bypass walls and moats; fire cannot hit air, archers/ice can; Sky Watch increases anti-air damage',()=>{
 const make=(tower,upgrade)=>{const {g}=setup();g.creative=true;g.place(tower,5,3);if(upgrade)g.upgrade(5,3);g.phase='wave';g.wave=6;g.remaining=1;g.spawnClock=9;const z={id:1,kind:'flying',x:3.5,y:3.5,hp:200,maxHp:200,speed:1,damage:5,reward:12,slow:0,bite:0,next:null,flash:0};g.zombies=[z];return {g,z};};
 for(const [type,damage] of [['fire',0],['archer',17],['ice',8]]){const {g,z}=make(type);g.update(.05);assert.equal(z.hp,200-damage);}
 const {g,z}=make('archer',true);g.place('stone',4,3);g.update(.05);assert.equal(z.hp,174.5);assert.ok(z.x>3.5);tick(g,2);assert.ok(z.x>4.5);assert.equal(g.get(4,3).hp,280);assert.equal(g.upgrade(5,3).ok,false);
});
test('every fifth zombie from wave six is flying and high scores are separated by difficulty/mode',()=>{
 const {g}=setup();g.wave=6;g.nextId=5;g.spawn();assert.equal(g.zombies[0].kind,'flying');g.phase='over';g.kills=3;g.recordScore();assert.equal(g.highScores['survival:normal'],530);g.creative=true;g.recordScore();assert.equal(g.highScores['creative:normal'],530);
});
test('original audio engine and soundtrack are preserved byte for byte',()=>{
 const bytes=fs.readFileSync(path.join(__dirname,'../dist/js/audio.js'));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),'08aed565b27e8b2b44ed86646a30d607a130b39d13bbbad7893f2932fdb9c8bc');
});
test('prototype writes do not overwrite original P0 or legacy entries',()=>{
 const {Z,g}=setup(),m=new Map();const storage={get length(){return m.size},key:i=>[...m.keys()][i],getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)};const old=g.snapshot();old.version=2;delete old.countdown;delete old.highScores;storage.setItem(Z.SAVE_KEY,JSON.stringify(old));const original=storage.getItem(Z.SAVE_KEY);const store=new Z.SaveStore(storage);store.write('auto',g);assert.equal(storage.getItem(Z.SAVE_KEY),original);const record=store.inspect().records[0].raw;storage.setItem('frederiks-zombie-castle.saves.auto.a',record);const reopened=new Z.SaveStore(storage);assert.equal(reopened.inspect().records.length,3);reopened.write('auto',g);assert.equal(storage.getItem('frederiks-zombie-castle.saves.auto.a'),record);
});
function prefs(){const m=new Map();return {m,async keys(){return {keys:[...m.keys()]}},async get({key}){return {value:m.get(key)??null}},async set({key,value}){m.set(key,value)}};}
test('native Preferences save is not reported successful until native write and read-back complete',async()=>{
 const {Z,g}=setup(),p=prefs(),store=await Z.NativeSaveStore.open(p);let release;const set=p.set;p.set=async arg=>{await new Promise(r=>release=r);await set(arg)};let completed=false;const saving=store.write('auto',g).then(r=>{completed=true;return r});await new Promise(r=>setTimeout(r,0));assert.equal(completed,false);release();assert.equal((await saving).ok,true);const reopened=await Z.NativeSaveStore.open(p);assert.equal(reopened.inspect().records[0].payload,g.exportSave());
});
test('native persistence retains the previous generation on failure and serializes concurrent snapshots',async()=>{
 const {Z,g}=setup(),p=prefs(),store=await Z.NativeSaveStore.open(p);await store.write('auto',g);g.coins=100;const a=store.write('auto',g);g.coins=200;const b=store.write('auto',g);assert.equal((await a).ok,true);assert.equal((await b).ok,true);assert.equal(JSON.parse(store.inspect().records[0].payload).coins,200);p.set=async()=>{throw Error('disk failed')};g.coins=300;assert.equal((await store.write('auto',g)).ok,false);assert.equal(JSON.parse(store.inspect().records[0].payload).coins,200);
});
