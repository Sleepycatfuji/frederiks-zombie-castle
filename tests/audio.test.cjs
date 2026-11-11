const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
function setup(){
  const nodes=[],timers=new Map();let created=0;
  const param=()=>({value:1,events:[],setValueAtTime(v,t){assert.ok(Number.isFinite(v)&&t>=0);this.value=v;this.events.push([v,t]);},exponentialRampToValueAtTime(v,t){assert.ok(v>0&&t>=0);this.events.push([v,t]);}});
  class AC{
    constructor(){created++;this.currentTime=0;this.state='suspended';this.destination={};}
    async resume(){this.state='running';}async suspend(){this.state='suspended';}
    createGain(){return {gain:param(),connect(){},disconnect(){}};}
    createOscillator(){const o={frequency:param(),connect(){},disconnect(){},start(t){this.startTime=t;},stop(t){assert.ok(t>this.startTime);this.stopTime=t;}};nodes.push(o);return o;}
  }
  const context={window:{ZCD:{},AudioContext:AC},setInterval(fn){timers.set(1,fn);return 1;},clearInterval(id){timers.delete(id);}};vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../dist/js/audio.js'),'utf8'),context);
  return {a:new context.window.ZCD.Audio(),nodes,timers,created:()=>created};
}
test('audio context and sound wait for a user-triggered unlock',async()=>{
  const {a,nodes,created}=setup();a.play('wave');assert.equal(created(),0);assert.equal(nodes.length,0);a.music=false;await a.unlock();assert.equal(created(),1);a.play('place');assert.equal(nodes.length,2);assert.equal(a.ctx.state,'running');
});
test('every requested effect schedules finite frequencies and stops its oscillators',async()=>{
  const {a,nodes}=setup();a.music=false;await a.unlock();
  for(const name of ['place','remove','archer','fire','ice','zombieHit','defeat','castleHit','wallHit','coin','wave','victory','gameover']){
    const before=nodes.length;a.play(name);assert.ok(nodes.length>before,name);
  }
  for(const n of nodes){assert.ok(n.stopTime>n.startTime);assert.ok(n.frequency.events[0][0]>0);assert.ok(n.frequency.events[0][0]<20000);}
});
test('effects and background music toggle independently; looping music schedules again',async()=>{
  const {a,nodes,timers}=setup();await a.unlock();assert.equal(timers.size,1);const initial=nodes.length;assert.ok(initial>0);
  a.toggleSfx();a.play('place');assert.equal(nodes.length,initial);assert.equal(timers.size,1);
  for(let i=1;i<=160;i++){a.ctx.currentTime=i*.25;timers.get(1)();}assert.ok(nodes.length>initial*10);a.toggleMusic();assert.equal(timers.size,0);assert.equal(a.musicBus.gain.value,0);
  a.toggleSfx();const before=nodes.length;a.play('ice');assert.ok(nodes.length>before);assert.equal(timers.size,0);
  a.toggleMusic();assert.equal(timers.size,1);a.stopMusic();
});
test('hidden pages suspend audio and resume the loop after returning',async()=>{
  const {a,timers}=setup();await a.unlock();await a.visibility(true);assert.equal(a.ctx.state,'suspended');assert.equal(timers.size,0);await a.visibility(false);assert.equal(a.ctx.state,'running');assert.equal(timers.size,1);a.stopMusic();
});
