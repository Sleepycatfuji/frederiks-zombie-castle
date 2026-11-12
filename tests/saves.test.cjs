const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function setup(){const c={window:{},console};vm.createContext(c);for(const file of ['data','engine','saves'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../dist/js/'+file+'.js'),'utf8'),c);return c.window.ZCD;}
function memory(){const data=new Map();return {data,get length(){return data.size;},key:i=>[...data.keys()][i],getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};}
function fixture(Z){const g=new Z.Game({starter:false,random:()=>.5});g.creative=true;for(const [i,t] of Object.keys(Z.BUILDINGS).entries())g.place(t,i,1);g.get(7,1).raised=true;g.get(2,1).upgrades={level:3};g.savedExtras.resources={gems:12};g.coins=789;g.difficulty='hard';g.startWave();for(let i=0;i<20;i++)g.update(.05);return g;}
test('v1 formats migrate purely; all buildings, positions, extra upgrade/resource fields and combat survive',()=>{
 const Z=setup(),g=fixture(Z);for(const difficulty of [true,false]){const original=JSON.parse(g.exportSave());original.version=1;if(!difficulty)delete original.difficulty;const raw=JSON.stringify(original),s=memory();s.setItem(Z.SAVE_KEY,raw);const store=new Z.SaveStore(s),state=store.inspect();assert.equal(state.records.length,1);const copy=new Z.Game();assert.equal(copy.importSave(state.records[0].payload).ok,true);assert.equal(copy.difficulty,difficulty?'hard':'normal');assert.deepEqual(JSON.parse(copy.exportSave()),{...original,version:3,difficulty:difficulty?'hard':'normal'});assert.equal(store.write('auto',copy).ok,true);assert.equal(s.getItem(Z.SAVE_KEY),raw);}
});
test('manual and autosave generations are independent and newest valid progress wins',()=>{
 const Z=setup(),s=memory(),store=new Z.SaveStore(s),g=fixture(Z);store.write('manual',g);const manual=store.inspect().records[0].raw;g.coins=800;store.write('auto',g);g.coins=900;store.write('auto',g);g.coins=1000;store.write('auto',g);const state=store.inspect();assert.equal(state.records.length,3);assert.equal(JSON.parse(state.records[0].payload).coins,1000);assert.equal(state.records.find(r=>r.slot==='manual').raw,manual);
});
test('truncated newest record falls back to verified older record; damaged bytes are quarantined before reuse',()=>{
 const Z=setup(),s=memory(),store=new Z.SaveStore(s),g=fixture(Z);store.write('auto',g);const first=g.exportSave();g.coins++;store.write('auto',g);const damagedKey=store.inspect().records[0].key;s.setItem(damagedKey,'{"format":1');const reopened=new Z.SaveStore(s),state=reopened.inspect();assert.equal(state.records[0].payload,first);assert.equal(state.invalid.length,1);assert.equal(reopened.write('auto',g).ok,true);assert.ok([...s.data.entries()].some(([k,v])=>k.includes('recovery.')&&v==='{"format":1'));
});
test('write exceptions, silent failures and quota failures never report success or destroy the newest good generation',()=>{
 for(const fail of ['throw','ignore','truncate']){const Z=setup(),s=memory(),store=new Z.SaveStore(s),g=fixture(Z);store.write('auto',g);const before=store.inspect().records[0].raw;const set=s.setItem;s.setItem=(k,v)=>{if(fail==='throw')throw Error('quota');if(fail==='truncate')set(k,v.slice(0,18));};g.coins++;assert.equal(store.write('auto',g).ok,false);const reopened=new Z.SaveStore(s);assert.ok(reopened.inspect().records.some(r=>r.raw===before));}
});
test('interruption after successful atomic write recovers newest generation without a pointer update',()=>{
 const Z=setup(),s=memory(),store=new Z.SaveStore(s),g=fixture(Z);store.write('auto',g);g.coins=4321;const set=s.setItem;s.setItem=(k,v)=>{set(k,v);throw Error('process stopped after commit');};assert.equal(store.write('auto',g).ok,false);assert.equal(JSON.parse(new Z.SaveStore(s).inspect().records[0].payload).coins,4321);
});
test('checksum detects valid JSON corruption; unsupported future saves prevent older clients overwriting data',()=>{
 const Z=setup(),s=memory(),g=fixture(Z),store=new Z.SaveStore(s);store.write('auto',g);const key=store.inspect().records[0].key;const e=JSON.parse(s.getItem(key));e.body.payload=e.body.payload.replace('789','790');s.setItem(key,JSON.stringify(e));assert.equal(new Z.SaveStore(s).inspect().records.length,0);
 const future=JSON.parse(g.exportSave());future.version=99;s.setItem(Z.SAVE_KEY,JSON.stringify(future));const reopen=new Z.SaveStore(s),before=[...s.data];assert.equal(reopen.write('auto',g).ok,false);assert.deepEqual([...s.data],before);
});
test('explicit checkpoints survive repeated autosaves and can restore a previous kingdom',()=>{
 const Z=setup(),s=memory(),store=new Z.SaveStore(s),g=fixture(Z);store.write('checkpoint',g);const checkpoint=store.inspect().records[0];for(let i=0;i<5;i++){g.coins++;store.write('auto',g);}const state=store.inspect();assert.ok(state.records.some(r=>r.raw===checkpoint.raw));const copy=new Z.Game();assert.equal(copy.importSave(checkpoint.payload).ok,true);assert.equal(copy.coins,789);
});
test('stale tab writes are rejected until progress is explicitly reselected',()=>{
 const Z=setup(),s=memory(),a=new Z.SaveStore(s),b=new Z.SaveStore(s),g=fixture(Z);a.inspect();b.inspect();a.write('auto',g);assert.equal(b.write('auto',g).conflict,true);b.accept();assert.equal(b.write('manual',g).ok,true);
});
test('blocked reads preserve data and return an actionable failure',()=>{
 const Z=setup(),store=new Z.SaveStore({getItem(){throw Error('denied');}});assert.equal(store.inspect().ok,false);assert.equal(store.write('auto',fixture(Z)).ok,false);
});

test('missing envelope metadata is corruption, not a newer format; recovery can continue',()=>{
 const Z=setup(),s=memory(),store=new Z.SaveStore(s),g=fixture(Z);store.write('auto',g);g.coins++;store.write('auto',g);s.setItem(store.inspect().records[0].key,'{}');const reopened=new Z.SaveStore(s);assert.equal(reopened.inspect().future,false);assert.equal(reopened.write('auto',g).ok,true);assert.ok([...s.data.entries()].some(([k,v])=>k.includes('recovery.')&&v==='{}'));
});
