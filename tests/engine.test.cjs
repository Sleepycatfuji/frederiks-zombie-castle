const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
function setup(starter=false){
  const events=[],context={window:{},Math,console};vm.createContext(context);
  for(const file of ['data','engine'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../dist/js/'+file+'.js'),'utf8'),context);
  const Z=context.window.ZCD,g=new Z.Game({starter,emit:e=>events.push(e),random:()=>.5});return {g,Z,events};
}
function memory(){const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)};}
function enemy(g,overrides={}){
  const z={id:1,kind:'silly',x:3.5,y:4.5,hp:200,maxHp:200,speed:0,damage:10,reward:9,slow:0,bite:0,next:null,flash:0,...overrides};
  g.zombies.push(z);return z;
}
function combat(g){g.phase='wave';g.wave=1;g.remaining=0;g.waveTotal=1;g.waveDefeated=0;}
function advance(g,seconds){for(let t=0;t<seconds;t+=.05)g.update(.05);}
test('all eight buildings place, charge their cost, occupy one cell, and refund half',()=>{
  const {g,Z}=setup();g.coins=1000;
  for(const [i,type] of Object.keys(Z.BUILDINGS).entries()){
    const before=g.coins;assert.equal(g.place(type,i,1).ok,true,type);assert.equal(g.get(i,1).type,type);assert.equal(g.coins,before-Z.BUILDINGS[type].cost);
    assert.equal(g.remove(i,1).ok,true);assert.equal(g.coins,before-Math.ceil(Z.BUILDINGS[type].cost/2));assert.equal(g.get(i,1),null);
  }
});
test('placement protects castle, occupied cells, zombies, boundaries, and budget',()=>{
  const {g}=setup();g.place('wood',2,2);
  for(const args of [['wood',6,4],['wood',2,2],['wood',-1,0],['wood',15,0],['wood',1.5,2],['unknown',1,1]])assert.equal(g.place(...args).ok,false);
  g.coins=0;assert.equal(g.place('stone',1,1).ok,false);g.creative=true;assert.equal(g.place('stone',1,1).ok,true);assert.equal(g.coins,0);
  enemy(g,{x:4.5,y:2.5});assert.equal(g.place('wood',4,2).ok,false);
});
test('starter fort and centered 3 by 2 castle fit a 15 by 10 grid',()=>{
  const {g,Z}=setup(true);assert.equal(g.cells.length,150);assert.equal(g.cells.filter(Boolean).length,8);assert.equal(g.cells.filter(b=>b?.type==='archer').length,2);
  assert.equal(g.hp,100);assert.equal(g.coins,420);let count=0;for(let y=0;y<10;y++)for(let x=0;x<15;x++)if(Z.isCastle(x,y))count++;assert.equal(count,6);
});
test('archer attacks automatically within range and never outside range',()=>{
  const {g,events}=setup();g.place('archer',5,4);combat(g);const near=enemy(g),far=enemy(g,{id:2,x:.5,y:.5});
  g.update(.05);assert.equal(near.hp,183);assert.equal(far.hp,200);assert.equal(events.some(e=>e.type==='shot'&&e.kind==='archer'),true);
  advance(g,.75);assert.equal(near.hp,166);
});
test('fire tower damages a cluster, while ice applies a real movement slow',()=>{
  const {g}=setup();g.place('fire',5,4);combat(g);const a=enemy(g),b=enemy(g,{id:2,y:4.9}),far=enemy(g,{id:3,y:2.5});g.update(.05);
  assert.equal(a.hp,177);assert.equal(b.hp,177);assert.equal(far.hp,200);
  const other=setup().g;other.place('ice',5,4);combat(other);const cold=enemy(other,{speed:1});other.update(.05);assert.equal(cold.hp,192);assert.ok(cold.slow>2);
  const start=cold.x;advance(other,.2);assert.ok(cold.x-start<.13,'ice reduces movement to 45%');
});
test('zombie defeat awards coins exactly once and triggers reward events',()=>{
  const {g,events}=setup();combat(g);const z=enemy(g,{hp:5});const before=g.coins;g.damageZombie(z,10,'archer');g.damageZombie(z,10,'archer');
  assert.equal(g.kills,1);assert.equal(g.coins,before+9);assert.equal(events.filter(e=>e.type==='defeat').length,1);
});
test('wood and stone walls block, take damage, and can be destroyed',()=>{
  for(const type of ['wood','stone']){
    const {g,events}=setup();g.place(type,2,4);combat(g);const z=enemy(g,{x:2.5,y:4.5,speed:1,damage:50});const initial=g.get(2,4).hp;
    g.update(.05);assert.equal(g.get(2,4).hp,initial-50);assert.equal(z.x,2.5);advance(g,6);assert.equal(g.get(2,4),null);assert.ok(z.x>2.5);assert.ok(events.some(e=>e.type==='wallHit'));
  }
});
test('moats are indestructible and slow crossing zombies to 35 percent speed',()=>{
  const {g}=setup();g.place('moat',2,4);combat(g);const z=enemy(g,{x:2.5,y:4.5,speed:1});advance(g,.5);
  assert.ok(z.x>2.66&&z.x<2.71);assert.equal(g.get(2,4).hp,0);assert.equal(g.blocked(g.get(2,4)),false);
});
test('drawbridges lower for passage, raise as destructible walls, and cannot trap a zombie',()=>{
  const {g}=setup();g.place('bridge',2,4);assert.equal(g.blocked(g.get(2,4)),false);
  assert.equal(g.toggleBridge(2,4).ok,true);assert.equal(g.blocked(g.get(2,4)),true);
  combat(g);enemy(g,{x:2.5,y:4.5,damage:20});g.update(.05);assert.equal(g.get(2,4).hp,160);
  assert.equal(g.toggleBridge(2,4).ok,true);assert.equal(g.toggleBridge(2,4).ok,false);assert.equal(g.get(2,4).raised,false);
  assert.equal(g.toggleBridge(0,0).ok,false);
});
test('mines pay only between waves, victory bonuses and castle repairs happen once',()=>{
  const {g,events}=setup();g.place('mine',1,1);g.place('mine',2,1);g.wave=2;g.hp=70;combat(g);g.wave=2;
  const before=g.coins;g.update(.05);assert.equal(g.phase,'countdown');assert.equal(g.lastIncome,110);assert.equal(g.coins,before+110);assert.equal(g.hp,78);advance(g,2);assert.equal(g.coins,before+110);assert.equal(events.filter(e=>e.type==='victory').length,1);
});
test('waves increase in size and strength, introduce new enemies, and cannot double-start',()=>{
  const {g}=setup();assert.equal(g.startWave(),true);assert.equal(g.wave,1);assert.equal(g.remaining,9);assert.equal(g.startWave(),false);g.spawn();const hp1=g.zombies[0].hp;
  g.phase='build';g.zombies=[];g.wave=4;g.startWave();g.spawn();assert.equal(g.remaining,21);assert.ok(g.zombies[0].hp>hp1);
  g.random=()=>.1;g.spawn();assert.equal(g.zombies.at(-1).kind,'big');g.wave=2;g.spawn();assert.equal(g.zombies.at(-1).kind,'speedy');
});
test('zombies navigate from the edge to the castle and cause game over; restart works',()=>{
  const {g,events}=setup();combat(g);enemy(g,{x:.5,y:4.5,speed:2,damage:50});advance(g,15);assert.equal(g.phase,'over');assert.equal(g.hp,0);assert.equal(events.filter(e=>e.type==='gameover').length,1);
  assert.equal(g.place('wood',1,1).ok,false);assert.equal(g.startWave(),false);g.reset();assert.equal(g.phase,'build');assert.equal(g.hp,100);assert.equal(g.zombies.length,0);assert.equal(g.wave,0);
});
test('pathfinding uses gaps but can break through a fully sealed perimeter',()=>{
  const {g}=setup();g.creative=true;
  for(let y=0;y<10;y++)if(y!==4)g.place('stone',4,y);
  combat(g);const z=enemy(g,{x:2.5,y:2.5,speed:1});advance(g,5);assert.ok(z.x>4.5,'walked through the gap');
  const h=setup().g;h.creative=true;for(let y=0;y<10;y++)h.place('wood',4,y);combat(h);const chewer=enemy(h,{x:3.5,y:4.5,speed:1,damage:100});advance(h,4);assert.ok(chewer.x>4.5,'chewed through a sealed wall');
});
test('pause stops simulation and double speed makes measurable progress',()=>{
  const {g}=setup();combat(g);const z=enemy(g,{speed:1});g.paused=true;advance(g,1);assert.equal(z.x,3.5);g.paused=false;g.speed=2;advance(g,.2);assert.ok(z.x>3.85);
});
test('fresh kingdom, active battle, and game-over saves round-trip',()=>{
  for(const phase of ['build','wave','over']){
    const {g}=setup(true),storage=memory();g.place('bridge',1,1);g.toggleBridge(1,1);g.creative=true;
    if(phase!=='build'){g.startWave();advance(g,5);if(phase==='over'){g.phase='over';g.hp=0;}}
    const state=JSON.stringify({cells:g.cells,zombies:g.zombies,coins:g.coins,wave:g.wave,phase:g.phase});
    assert.equal(g.save(storage).ok,true);g.reset(false);assert.equal(g.load(storage).ok,true,phase);
    assert.equal(JSON.stringify({cells:g.cells,zombies:g.zombies,coins:g.coins,wave:g.wave,phase:g.phase}),state);assert.equal(g.pathDirty,true);assert.equal(g.creative,true);
  }
});
test('long-running wave saves remain valid when towers and spawn timers are idle',()=>{
  const {g}=setup();g.place('archer',0,0);combat(g);enemy(g,{x:14.5,y:9.5});advance(g,20);const storage=memory();g.save(storage);assert.equal(g.load(storage).ok,true);
});
test('missing, blocked, and corrupt storage leave the current kingdom intact',()=>{
  const {g,Z}=setup(true),storage=memory(),before=JSON.stringify(g.cells);assert.equal(g.load(storage).ok,false);
  assert.equal(g.save().ok,false,'unavailable localStorage global is handled');assert.equal(g.load().ok,false);
  const denied={getItem(){throw Error('denied');},setItem(){throw Error('quota');}};assert.equal(g.save(denied).ok,false);assert.equal(g.load(denied).ok,false);
  for(const bad of ['{bad json','{}']){storage.setItem(Z.SAVE_KEY,bad);assert.equal(g.load(storage).ok,false);assert.equal(JSON.stringify(g.cells),before);}
  g.save(storage);const s=JSON.parse(storage.getItem(Z.SAVE_KEY));s.cells[0]={type:'__proto__',hp:1,cooldown:0,raised:false};storage.setItem(Z.SAVE_KEY,JSON.stringify(s));assert.equal(g.load(storage).ok,false);assert.equal(JSON.stringify(g.cells),before);
});
test('complete starter-fort wave succeeds without manual attacks',()=>{
  const {g,events}=setup(true);let seed=127;g.random=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};g.startWave();for(let i=0;i<2000&&g.phase==='wave';i++)g.update(.05);
  assert.equal(g.phase,'countdown');assert.equal(g.wave,1);assert.equal(g.kills,9);assert.ok(g.hp>0);assert.ok(events.some(e=>e.type==='victory'));
});
test('portable saves preserve all buildings, coins, difficulty and active combat across browsers',()=>{
  const {g}=setup();g.creative=true;
  for(const [i,type] of ['wood','stone','archer','fire','ice','mine','moat','bridge'].entries())g.place(type,i,1);
  g.difficulty='hard';g.startWave();advance(g,1);g.coins=1234;
  const raw=g.exportSave(),{g:other}=setup();assert.equal(other.importSave(raw).ok,true);
  assert.equal(other.exportSave(),raw);const store=memory();other.save(store);other.reset();other.load(store);
  assert.equal(other.difficulty,'hard');assert.equal(other.coins,1234);assert.equal(other.cells.filter(Boolean).length,8);assert.ok(other.zombies.length);
});
test('legacy original saves load as Normal and malformed imports never replace the kingdom',()=>{
  const {g}=setup(true),legacy=JSON.parse(g.exportSave());delete legacy.difficulty;
  assert.equal(g.importSave(JSON.stringify(legacy)).ok,true);assert.equal(g.difficulty,'normal');
  const before=g.exportSave();
  for(const raw of ['{','null',JSON.stringify({...legacy,difficulty:'impossible'}),'x'.repeat(5*1024*1024+1),JSON.stringify({...legacy,cells:[]})]){
    assert.equal(g.importSave(raw).ok,false);assert.equal(g.exportSave(),before);
  }
});
test('Easy and Hard scale zombie health and damage; Normal retains original values',()=>{
  const {g}=setup();g.wave=1;
  for(const [difficulty,factor] of [['easy',.7],['normal',1],['hard',1.4]]){
    g.difficulty=difficulty;g.spawn();const z=g.zombies.at(-1);const {Z}=setup();
    assert.equal(z.hp,Z.MONSTERS[z.kind].hp*factor);assert.equal(z.damage,Z.MONSTERS[z.kind].damage*factor);
  }
});
