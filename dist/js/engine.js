/* Simulation has no DOM or audio dependencies. Coordinates are in grid tiles. */
(function (Z) {
  'use strict';
  const DIFFICULTIES = {easy:.7, normal:1, hard:1.4};
  const VERSION = 1, KEY = 'zombie-castle-defense-v1';
  class Game {
    constructor({ emit = () => {}, random = Math.random, starter = true } = {}) {
      this.emit = emit; this.random = random; this.reset(starter);
    }
    reset(starter = true) {
      this.cells = Array(150).fill(null); this.zombies = []; this.coins = 420;
      this.hp = 100; this.wave = 0; this.kills = 0; this.phase = 'build';
      this.difficulty = 'normal'; this.creative = false; this.paused = false; this.speed = 1;
      this.remaining = 0; this.spawnClock = 0; this.nextId = 1; this.pathDirty = true;
      this.lastIncome = 0; this.elapsed = 0; this.waveTotal = 0; this.waveDefeated = 0;
      if (starter) {
        for (const [type, x, y] of [['archer',5,4],['archer',9,5],['wood',6,3],['wood',7,3],['wood',8,3],['wood',6,6],['wood',7,6],['wood',8,6]]) this.cells[y*15+x] = this.makeBuilding(type);
      }
      this.emit({type:'reset'});
    }
    makeBuilding(type) { return {type, hp:Z.BUILDINGS[type].hp, cooldown:0, raised:false}; }
    get(x,y) { return Z.inside(x,y) ? this.cells[y*15+x] : null; }
    blocked(b) { return !!b && (Z.BUILDINGS[b.type].block || (b.type === 'bridge' && b.raised)); }
    canPlace(type,x,y) {
      if (!Object.hasOwn(Z.BUILDINGS,type)) return 'Choose a building first.';
      if (this.phase === 'over') return 'Start a new kingdom to build again.';
      if (!Z.inside(x,y)) return 'Build inside the meadow.';
      if (Z.isCastle(x,y)) return 'This is your castle. Keep it safe!';
      if (this.get(x,y)) return 'There is already a building here.';
      if (this.zombies.some(z=>Math.floor(z.x)===x && Math.floor(z.y)===y)) return 'A zombie is standing here!';
      if (!this.creative && this.coins < Z.BUILDINGS[type].cost) return 'You need a few more coins.';
      return '';
    }
    place(type,x,y) {
      const error = this.canPlace(type,x,y); if (error) return {ok:false,message:error};
      this.cells[y*15+x] = this.makeBuilding(type);
      if (!this.creative) this.coins -= Z.BUILDINGS[type].cost;
      this.pathDirty = true; this.emit({type:'place',x:x+.5,y:y+.5});
      return {ok:true,message:Z.BUILDINGS[type].name+' built!'};
    }
    remove(x,y) {
      if (this.phase==='over') return {ok:false,message:'Start a new kingdom to build again.'};
      const b = this.get(x,y); if (!b) return {ok:false,message:'Choose a building to remove.'};
      const refund = Math.floor(Z.BUILDINGS[b.type].cost * .5);
      this.cells[y*15+x] = null; if (!this.creative) this.coins += refund;
      this.pathDirty = true; this.emit({type:'remove',x:x+.5,y:y+.5});
      return {ok:true,message:`Building removed. ${this.creative ? '' : '+'+refund+' coins back!'}`};
    }
    toggleBridge(x,y) {
      if (this.phase==='over') return {ok:false,message:'Start a new kingdom to use the bridges.'};
      const b = this.get(x,y);
      if (!b || b.type!=='bridge') return {ok:false,message:'Click a drawbridge to raise or lower it.'};
      if (!b.raised && this.zombies.some(z=>Math.floor(z.x)===x && Math.floor(z.y)===y)) return {ok:false,message:'Wait until the zombie leaves the bridge.'};
      b.raised = !b.raised; this.pathDirty = true; this.emit({type:'place',x:x+.5,y:y+.5});
      return {ok:true,message:'Drawbridge '+(b.raised?'raised. Zombies shall not pass!':'lowered. Crossing open!')};
    }
    startWave() {
      if (this.phase!=='build') return false;
      this.wave++; this.phase='wave'; this.remaining=6+this.wave*3;
      this.waveTotal=this.remaining; this.waveDefeated=0; this.spawnClock=.3;
      this.emit({type:'wave',wave:this.wave}); return true;
    }
    spawn() {
      const r=this.random(), kind=this.wave>=4 && r<.2?'big':this.wave>=2 && r<.4?'speedy':'silly';
      const d=Z.MONSTERS[kind], edge=Math.floor(this.random()*4);
      let x=Math.floor(this.random()*15), y=Math.floor(this.random()*10);
      if(edge===0) x=0; if(edge===1) x=14; if(edge===2) y=0; if(edge===3) y=9;
      const factor=DIFFICULTIES[this.difficulty];
      const hp=d.hp*(1+(this.wave-1)*.17)*factor;
      this.zombies.push({id:this.nextId++,kind,x:x+.5,y:y+.5,hp,maxHp:hp,speed:d.speed*(1+Math.min(.65,this.wave*.025)),damage:d.damage*(1+(this.wave-1)*.08)*factor,reward:d.reward,slow:0,bite:0,next:null,flash:0});
      this.emit({type:'spawn',x:x+.5,y:y+.5});
    }
    tileCost(i) {
      const b=this.cells[i];
      if(this.blocked(b)) return 4+b.hp/28;
      if(b?.type==='moat') return 2.8;
      return 1;
    }
    buildPaths() {
      // Reverse Dijkstra: zombies favor open paths, but will chew through a sealed fort.
      const d=Array(150).fill(Infinity), seen=new Set();
      for(let y=4;y<=5;y++) for(let x=6;x<=8;x++) d[y*15+x]=0;
      for(let n=0;n<150;n++) {
        let best=-1;
        for(let i=0;i<150;i++) if(!seen.has(i)&&(best<0||d[i]<d[best])) best=i;
        if(best<0||!Number.isFinite(d[best])) break;
        seen.add(best);
        for(const j of this.neighbors(best)) if(d[best]+this.tileCost(best)<d[j]) d[j]=d[best]+this.tileCost(best);
      }
      this.distances=d; this.pathDirty=false;
      // Reconsider a route at the next tile center, never teleport mid-step.
    }
    neighbors(i) {
      const x=i%15,y=Math.floor(i/15), a=[];
      if(x>0)a.push(i-1); if(x<14)a.push(i+1); if(y>0)a.push(i-15); if(y<9)a.push(i+15);
      return a;
    }
    damageZombie(z,damage,kind) {
      if(z.hp<=0)return;
      z.hp-=damage; z.flash=.16;
      this.emit({type:'zombieHit',x:z.x,y:z.y,kind});
      if(z.hp<=0) {
        this.kills++; this.waveDefeated++; this.coins+=z.reward;
        this.emit({type:'defeat',x:z.x,y:z.y,reward:z.reward});
      }
    }
    update(dt) {
      if(this.paused || this.phase!=='wave') return;
      dt=Math.min(dt,.1)*this.speed; this.elapsed+=dt;
      if(this.pathDirty)this.buildPaths();
      this.spawnClock=Math.max(0,this.spawnClock-dt);
      if(this.remaining>0 && this.spawnClock<=0) {
        this.spawn(); this.remaining--; this.spawnClock=Math.max(.34,1.05-this.wave*.035);
      }
      for(let i=0;i<150;i++) {
        const b=this.cells[i]; if(!b)continue;
        const d=Z.BUILDINGS[b.type]; if(!d.range)continue;
        b.cooldown=Math.max(0,b.cooldown-dt); if(b.cooldown>0)continue;
        const x=i%15+.5,y=Math.floor(i/15)+.5;
        const targets=this.zombies.filter(z=>z.hp>0&&Math.hypot(z.x-x,z.y-y)<=d.range);
        targets.sort((a,c)=>this.distances[Math.floor(a.y)*15+Math.floor(a.x)]-this.distances[Math.floor(c.y)*15+Math.floor(c.x)]);
        const target=targets[0]; if(!target)continue;
        b.cooldown=d.rate;
        this.emit({type:'shot',kind:b.type,x,y,tx:target.x,ty:target.y});
        const victims=d.splash?this.zombies.filter(z=>z.hp>0&&Math.hypot(z.x-target.x,z.y-target.y)<=d.splash):[target];
        for(const z of victims) { if(d.slow)z.slow=d.slow; this.damageZombie(z,d.damage,b.type); }
      }
      this.zombies=this.zombies.filter(z=>z.hp>0);
      for(const z of this.zombies) {
        if(z.hp<=0)continue;
        z.slow=Math.max(0,z.slow-dt); z.flash=Math.max(0,z.flash-dt); z.bite=Math.max(0,z.bite-dt);
        const cx=Math.max(0,Math.min(14,Math.floor(z.x))),cy=Math.max(0,Math.min(9,Math.floor(z.y)));
        if(Z.isCastle(cx,cy)) {
          if(z.bite<=0) {
            this.hp=Math.max(0,this.hp-z.damage*.8); z.bite=1;
            this.emit({type:'castleHit',x:z.x,y:z.y});
            if(this.hp<=0) { this.phase='over';this.emit({type:'gameover'});return; }
          }
          continue;
        }
        let obstruction=this.get(cx,cy), ox=cx,oy=cy;
        if(!this.blocked(obstruction)) {
          if(!z.next) {
            const candidates=this.neighbors(cy*15+cx);
            candidates.sort((a,b)=>(this.distances[a]+this.tileCost(a))-(this.distances[b]+this.tileCost(b)));
            const ni=candidates[0]; z.next={x:ni%15+.5,y:Math.floor(ni/15)+.5};
          }
          ox=Math.floor(z.next.x);oy=Math.floor(z.next.y);obstruction=this.get(ox,oy);
        }
        if(this.blocked(obstruction)) {
          if(z.bite<=0) {
            obstruction.hp-=z.damage; z.bite=.8;
            this.emit({type:'wallHit',x:ox+.5,y:oy+.5});
            if(obstruction.hp<=0) { this.cells[oy*15+ox]=null;this.pathDirty=true;this.emit({type:'crumble',x:ox+.5,y:oy+.5}); }
          }
          continue;
        }
        if(!z.next)continue;
        let pace=z.speed*(z.slow>0?.45:1);
        if(this.get(cx,cy)?.type==='moat')pace*=.35;
        const dx=z.next.x-z.x,dy=z.next.y-z.y,dist=Math.hypot(dx,dy),step=pace*dt;
        if(dist<=step) {z.x=z.next.x;z.y=z.next.y;z.next=null;}
        else {z.x+=dx/dist*step;z.y+=dy/dist*step;}
      }
      this.zombies=this.zombies.filter(z=>z.hp>0);
      if(this.remaining===0 && this.zombies.length===0) this.finishWave();
    }
    finishWave() {
      this.phase='build';const mines=this.cells.filter(b=>b?.type==='mine').length;
      this.lastIncome=40+this.wave*5+mines*30;this.coins+=this.lastIncome;
      this.hp=Math.min(100,this.hp+8);
      this.emit({type:'victory',income:this.lastIncome,mines,wave:this.wave});
    }
    snapshot() {
      return {version:VERSION,difficulty:this.difficulty,cells:this.cells,coins:this.coins,hp:this.hp,wave:this.wave,kills:this.kills,phase:this.phase,creative:this.creative,zombies:this.zombies,remaining:this.remaining,spawnClock:this.spawnClock,nextId:this.nextId,waveTotal:this.waveTotal||0,waveDefeated:this.waveDefeated||0,lastIncome:this.lastIncome,elapsed:this.elapsed};
    }
    exportSave() { return JSON.stringify(this.snapshot(), null, 2); }
    importSave(raw) {
      if(typeof raw!=='string'||raw.length>5*1024*1024)return {ok:false,message:'Save file is too large.'};
      return this.load({getItem:()=>raw});
    }
    save(storage) {
      try {(storage||localStorage).setItem(KEY,this.exportSave());return {ok:true,message:'Kingdom saved on this browser!'};}
      catch {return {ok:false,message:'Saving is unavailable. Check your browser storage settings.'};}
    }
    load(storage) {
      try {
        const raw=(storage||localStorage).getItem(KEY);if(!raw)return {ok:false,message:'No saved kingdom yet. Build one and press Save!'};
        const s=JSON.parse(raw);this.validate(s);
        for(const key of ['cells','coins','hp','wave','kills','phase','creative','zombies','remaining','spawnClock','nextId','waveTotal','waveDefeated','lastIncome','elapsed'])this[key]=s[key];
        this.difficulty=s.difficulty||'normal';
        this.pathDirty=true;this.paused=false;this.speed=1;this.emit({type:'loaded'});
        return {ok:true,message:'Welcome back! Your kingdom is ready.'};
      } catch {return {ok:false,message:'This save could not be loaded. Your current kingdom is safe.'};}
    }
    validate(s) {
      const finite=(v,min=0,max=1e9)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
      if(!s||s.version!==VERSION||!Array.isArray(s.cells)||s.cells.length!==150||!Array.isArray(s.zombies)||s.zombies.length>10000)throw Error('Invalid save');
      if(s.difficulty!==undefined&&!Object.hasOwn(DIFFICULTIES,s.difficulty))throw Error('Invalid difficulty');
      if(!['build','wave','over'].includes(s.phase)||typeof s.creative!=='boolean')throw Error('Invalid state');
      for(const k of ['coins','wave','kills','remaining','nextId','waveTotal','waveDefeated','lastIncome','elapsed'])if(!finite(s[k]))throw Error('Invalid number');
      if(!finite(s.hp,0,100)||!finite(s.spawnClock,-10,10))throw Error('Invalid state');
      if(s.phase==='build'&&(s.zombies.length||s.remaining))throw Error('Invalid wave');
      for(let i=0;i<150;i++) {
        const b=s.cells[i];if(b===null)continue;
        if(!b||!Object.hasOwn(Z.BUILDINGS,b.type)||Z.isCastle(i%15,Math.floor(i/15))||!finite(b.hp,0,Z.BUILDINGS[b.type].hp)||!finite(b.cooldown,-1,10)||typeof b.raised!=='boolean')throw Error('Invalid building');
      }
      for(const z of s.zombies) {
        if(!Object.hasOwn(Z.MONSTERS,z.kind)||!finite(z.x,0,14.999)||!finite(z.y,0,9.999))throw Error('Invalid zombie');
        for(const k of ['id','hp','maxHp','speed','damage','reward','slow','flash'])if(!finite(z[k]))throw Error('Invalid zombie');
        if(!finite(z.bite,-1,10)||z.hp<=0||z.hp>z.maxHp)throw Error('Invalid zombie health');
        if(z.next!==null&&(!finite(z.next.x,.5,14.5)||!finite(z.next.y,.5,9.5)))throw Error('Invalid path');
      }
    }
  }
  Z.Game=Game;Z.SAVE_KEY=KEY;
})(window.ZCD);
