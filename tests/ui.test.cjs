/* Headless DOM/Canvas smoke test. This does not replace visual browser QA. */
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');
function boot(){
  let paintCalls=0;
  const ctx=new Proxy({}, {get(o,k){if(k in o)return o[k];return (...args)=>{paintCalls++;for(const a of args)if(typeof a==='number')assert.ok(Number.isFinite(a),'finite Canvas coordinate');};},set(o,k,v){o[k]=v;return true;}});
  class Element{
    constructor(tag){this.tagName=tag.toUpperCase();this.attrs={};this.children=[];this.parent=null;this.events={};this.style={};this.dataset={};this._text='';this.open=false;this.disabled=false;}
    setAttribute(k,v){this.attrs[k]=String(v);if(k==='id')this.id=String(v);if(k==='open')this.open=true;}
    getAttribute(k){return this.attrs[k]??null;}
    get className(){return this.attrs.class||'';}set className(v){this.attrs.class=v;}
    get classList(){return {add:(s)=>{this.classList.toggle(s,true);},remove:(s)=>{this.classList.toggle(s,false);},toggle:(s,on)=>{const a=new Set(this.className.split(' ').filter(Boolean));if(on===undefined)on=!a.has(s);on?a.add(s):a.delete(s);this.className=[...a].join(' ');return on;},contains:s=>this.className.split(' ').includes(s)};}
    append(...nodes){for(const n of nodes){n.parent=this;this.children.push(n);}}
    set textContent(t){this._text=String(t);this.children=[];}get textContent(){return this._text+this.children.map(c=>c.textContent).join('');}
    set innerHTML(s){this.children=[];this._text='';parse(String(s),this);}get innerHTML(){return this._text;}
    addEventListener(name,fn,options){(this.events[name]??=[]).push({fn,once:options?.once});}
    dispatch(name,data={}){for(const h of [...(this.events[name]||[])]){h.fn({target:this,preventDefault(){},...data});if(h.once)this.events[name]=this.events[name].filter(v=>v!==h);}if(this['on'+name])this['on'+name]({target:this,preventDefault(){},...data});}
    click(){if(!this.disabled)this.dispatch('click');}
    querySelector(s){return this.querySelectorAll(s)[0]||null;}
    querySelectorAll(s){const results=[];for(const child of this.children){if(matches(child,s))results.push(child);results.push(...child.querySelectorAll(s));}return results;}
    getContext(){return ctx;}
    getBoundingClientRect(){return {left:0,top:0,width:900,height:600};}
    focus(){doc.activeElement=this;this.dispatch('focus');}
    showModal(){this.open=true;this.attrs.open='';}
    close(){this.open=false;delete this.attrs.open;this.dispatch('close');}
  }
  function matches(el,selector){
    if(selector.includes(','))return selector.split(',').some(s=>matches(el,s.trim()));
    if(selector.includes(' ')){const bits=selector.split(' ');if(!matches(el,bits.pop()))return false;let p=el.parent;while(p){if(matches(p,bits.join(' ')))return true;p=p.parent;}return false;}
    if(selector.endsWith(':last-child')){if(el.parent?.children.at(-1)!==el)return false;selector=selector.replace(':last-child','');}
    if(selector.includes('[open]')){if(!el.open)return false;selector=selector.replace('[open]','');}
    if(selector.startsWith('.'))return el.classList.contains(selector.slice(1));
    if(selector.startsWith('#'))return el.id===selector.slice(1);
    return el.tagName===selector.toUpperCase();
  }
  function parse(html,root){
    const stack=[root],voids=new Set(['META','LINK','INPUT','BR','HR','IMG']);
    const regex=/<!--[\s\S]*?-->|<![^>]*>|<\/?[\w:-]+(?:\s[^>]*?)?\/?\s*>|[^<]+/g;
    for(const m of html.matchAll(regex)){
      const token=m[0];if(token.startsWith('<!'))continue;
      if(token.startsWith('</')){if(stack.length>1)stack.pop();continue;}
      if(token.startsWith('<')){
        const tag=token.match(/^<([\w:-]+)/)[1],el=new Element(tag);
        const attr=token.slice(tag.length+1,-1);for(const a of attr.matchAll(/([\w:-]+)(?:="([^"]*)")?/g))el.setAttribute(a[1],a[2]??'');
        stack.at(-1).append(el);if(!voids.has(el.tagName)&&!token.endsWith('/>'))stack.push(el);
      }else stack.at(-1)._text+=token;
    }
  }
  const doc=new Element('document');doc.createElement=tag=>new Element(tag);doc.getElementById=id=>doc.querySelector('#'+id);doc.hidden=false;
  parse(fs.readFileSync(path.join(__dirname,'../dist/index.html'),'utf8'),doc);
  const storage=new Map(),frames=[];
  const context={window:{addEventListener(){}},document:doc,console,performance:{now:()=>0},requestAnimationFrame:fn=>frames.push(fn),setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){},localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)}};
  vm.createContext(context);for(const f of ['data','engine','audio','render','saves','preferences','leaderboard','app'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../dist/js/'+f+'.js'),'utf8'),context,{filename:f+'.js'});
  doc.getElementById('welcome-new').click();doc.getElementById('confirm-new').click();
  return {doc,$:id=>doc.getElementById(id),...context.window.zombieCastle,paintCalls:()=>paintCalls,frame:t=>frames.shift()(t),key:k=>doc.dispatch('keydown',{key:k,target:doc.getElementById('game')})};
}
test('full application boots, draws original sprites, and selects every palette item',()=>{
  const u=boot();assert.equal(u.doc.querySelectorAll('.building-card').length,8);
  for(const type of ['wood','stone','archer','fire','ice','mine','moat','bridge']){const b=u.doc.querySelectorAll('.building-card').find(b=>b.dataset.building===type);b.click();assert.equal(u.renderer.selected,type);assert.equal(b.getAttribute('aria-pressed'),'true');u.frame(16);}
  assert.ok(u.paintCalls()>1000);assert.equal(u.$('tool-build').getAttribute('aria-pressed'),'true');
});
test('keyboard building, bridge tool, removal, and right-click controls connect to the simulation',()=>{
  const u=boot();u.key('8');u.renderer.hover={x:4,y:4};u.key('Enter');assert.equal(u.game.get(4,4).type,'bridge');assert.equal(u.game.get(4,4).raised,false);
  u.$('tool-bridge').click();assert.equal(u.$('tool-bridge').getAttribute('aria-pressed'),'true');assert.equal(u.$('tool-build').getAttribute('aria-pressed'),'false');u.key('Enter');assert.equal(u.game.get(4,4).raised,true);
  u.key('r');u.key('Enter');assert.equal(u.game.get(4,4),null);u.key('Escape');assert.equal(u.renderer.selected,'bridge');
  u.$('game').dispatch('click',{clientX:270,clientY:270});assert.equal(u.game.get(4,4).type,'bridge');u.$('game').dispatch('contextmenu',{clientX:270,clientY:270});assert.equal(u.game.get(4,4),null);
});
test('wave, pause, speed, mode, help, save/load, game-over and restart controls work together',()=>{
  const u=boot();u.$('start-wave').click();assert.equal(u.game.phase,'wave');assert.equal(u.$('start-wave').disabled,true);u.frame(50);u.$('pause').click();assert.equal(u.game.paused,true);u.$('pause').click();assert.equal(u.game.paused,false);u.$('speed').click();assert.equal(u.game.speed,2);
  u.$('help').click();assert.equal(u.$('help-dialog').open,true);assert.equal(u.game.paused,true);u.$('help-dialog').querySelector('.close-action').click();assert.equal(u.game.paused,false);
  u.$('mode').click();u.$('creative-mode').click();assert.equal(u.game.creative,true);
  u.$('save').click();const before=u.game.coins;u.game.coins=7;u.$('load').click();u.$('confirm-load').click();assert.equal(u.game.coins,before);assert.equal(u.game.phase,'wave');assert.equal(u.doc.querySelector('dialog[open]'),null);
  u.game.hp=0;u.game.phase='over';u.game.emit({type:'gameover'});assert.equal(u.$('over-dialog').open,true);u.$('restart').click();u.$('confirm-new').click();assert.equal(u.game.phase,'build');assert.equal(u.game.hp,100);assert.equal(u.game.creative,true);assert.equal(u.$('over-dialog').open,false);
});
test('difficulty UI survives Save, Load and New kingdom',()=>{
  const u=boot();u.$('difficulty').value='hard';u.$('difficulty').onchange();u.$('save').click();
  u.$('difficulty').value='easy';u.$('difficulty').onchange();u.$('load').click();u.$('confirm-load').click();
  assert.equal(u.game.difficulty,'hard');assert.equal(u.$('difficulty').value,'hard');
  u.$('new-game').click();u.$('confirm-new').click();assert.equal(u.game.difficulty,'hard');
});
