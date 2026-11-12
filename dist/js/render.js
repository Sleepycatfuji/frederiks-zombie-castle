/* Hand-drawn pixel shapes. Everything, including the UI icons, uses these original sprites. */
(function(Z){
  'use strict';
  const ink='#344746';
  function rect(c,x,y,w,h,color){c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),w,h);}
  function poly(c,points,color){c.fillStyle=color;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();}
  function shadow(c,x=30,y=49,rx=22,ry=6){c.fillStyle='#334d3530';c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();}
  function stone(c,x,y,w,h,color='#b5c4bc'){
    rect(c,x-2,y-2,w+4,h+4,ink);rect(c,x,y,w,h,color);rect(c,x,y,w,4,'#e0e7d2');
    for(let yy=y+10;yy<y+h;yy+=11){rect(c,x,yy,w,2,'#839e96');for(let xx=x+(yy%2?8:16);xx<x+w;xx+=19)rect(c,xx,yy-9,2,9,'#8ba399');}
  }
  function roof(c,x,y,w=32,color='#7461a5'){
    poly(c,[[x-3,y+18],[x+w/2,y-3],[x+w+3,y+18]],ink);
    poly(c,[[x,y+16],[x+w/2,y],[x+w,y+16]],color);
    rect(c,x+7,y+11,w-14,3,'#a48bc5');rect(c,x+12,y+6,w-24,3,'#a48bc5');
  }
  function sprite(c,type,b={},time=0){
    const artwork=Z.BUILDINGS[type]?.artwork;if(typeof artwork==='function'){artwork(c,b,time);return;}type=artwork||type;
    shadow(c);
    if(type==='wood'){
      rect(c,5,23,50,25,'#654c37');rect(c,8,25,44,7,'#c99454');rect(c,8,37,44,7,'#ac7543');
      for(let x=9;x<56;x+=14){rect(c,x,17,9,34,'#664b36');rect(c,x+2,19,5,30,'#d2a16b');rect(c,x+2,19,5,4,'#e9bd7b');rect(c,x+3,29,2,2,'#684c38');rect(c,x+3,42,2,2,'#684c38');}
    }else if(type==='stone'){
      stone(c,7,21,46,27);for(let x=7;x<54;x+=17)stone(c,x,14,11,10,'#c9d4c4');
      rect(c,10,48,40,3,'#758e83');
    }else if(['archer','fire','ice'].includes(type)){
      stone(c,17,25,27,27);rect(c,26,37,8,15,'#52685e');
      if(type==='archer'){
        rect(c,10,19,41,10,ink);rect(c,13,20,35,6,'#c99a5c');
        for(let x=11;x<51;x+=14){rect(c,x,11,10,11,ink);rect(c,x+2,13,6,8,'#d7b379');}
        rect(c,27,16,7,7,'#f1c496');rect(c,25,13,11,4,'#527943');rect(c,28,9,2,5,'#f4d05a');
        c.strokeStyle='#6c4933';c.lineWidth=2;c.beginPath();c.arc(37,21,7,-1.6,1.6);c.stroke();rect(c,33,20,12,2,'#f2e2b3');
      }else if(type==='fire'){
        stone(c,12,17,36,12,'#b6b7a2');rect(c,19,13,22,7,'#6c6053');
        poly(c,[[20,14],[19,5],[26,8],[30,-1],[34,7],[39,5],[41,14],[35,20],[25,20]],'#dc6340');
        poly(c,[[25,15],[27,7],[30,11],[33,5],[36,15],[31,19]],'#ffd46a');
      }else{
        stone(c,12,19,36,10,'#a2c8cd');poly(c,[[30,-2],[42,12],[30,25],[18,12]],ink);
        poly(c,[[30,1],[39,12],[30,22],[21,12]],'#7cdaec');poly(c,[[30,1],[30,22],[21,12]],'#c0f4ee');rect(c,28,6,3,7,'#f2ffec');
      }
    }else if(type==='mine'){
      poly(c,[[5,47],[6,32],[16,19],[21,10],[39,13],[52,30],[55,47]],ink);
      poly(c,[[8,45],[9,32],[21,13],[37,16],[49,32],[52,45]],'#999b80');
      rect(c,20,28,22,20,'#4c5c52');rect(c,17,24,6,25,'#9a7348');rect(c,39,24,6,25,'#9a7348');rect(c,16,23,31,6,'#c59b58');
      rect(c,27,35,7,6,'#eebf40');rect(c,33,38,7,7,'#ffdf69');rect(c,26,46,26,4,'#756747');
      rect(c,8,35,7,6,'#edc44a');rect(c,36,19,5,4,'#f4d660');rect(c,43,43,9,7,'#e8b447');
    }else if(type==='moat'){
      rect(c,1,5,58,52,'#648d73');rect(c,3,7,54,48,'#48a7b9');rect(c,5,10,50,42,'#65c9d3');
      const offset=Math.floor(time*2)%3;
      for(let i=0;i<3;i++){rect(c,10+((i+offset)%3)*5,18+i*13,22,3,'#a5e9d9');rect(c,34-i*6,23+i*12,12,2,'#b3efdf');}
      rect(c,4,9,52,3,'#92d0ad');rect(c,6,52,48,3,'#4c96a1');
    }else if(type==='bridge'){
      rect(c,2,6,56,50,'#529f9e');rect(c,5,8,50,46,'#70c8cc');
      rect(c,7,12,6,43,ink);rect(c,48,12,6,43,ink);
      if(b.raised){
        rect(c,13,6,35,44,ink);rect(c,16,8,29,38,'#9b7146');
        for(let y=10;y<45;y+=8)rect(c,16,y,29,3,'#d3a66a');
        rect(c,10,3,5,32,'#e8d3a0');rect(c,47,3,5,32,'#e8d3a0');
      }else{
        rect(c,13,9,35,46,'#765a3e');for(let y=10;y<54;y+=8)rect(c,15,y,31,6,'#d1a26a');
        rect(c,9,12,3,40,'#edcb89');rect(c,49,12,3,40,'#edcb89');
      }
    }
  }
  function castle(c,time){
    shadow(c,90,112,88,13);
    rect(c,12,23,156,85,ink);rect(c,15,26,150,79,'#b6c5b4');
    for(let y=31;y<100;y+=14){rect(c,17,y,146,2,'#8fa996');for(let x=18+(y%3)*9;x<160;x+=27)rect(c,x,y,2,14,'#91aa98');}
    rect(c,59,39,62,63,'#d7dfc7');rect(c,62,41,56,5,'#f0eed5');
    roof(c,56,18,68);rect(c,86,6,3,20,'#5e5755');poly(c,[[89,6],[111,11],[89,17]],'#f4b94e');
    rect(c,78,73,25,34,ink);rect(c,81,77,19,29,'#7d5c45');rect(c,83,80,15,26,'#a27a4f');
    rect(c,85,80,2,24,'#c69c61');rect(c,94,80,2,24,'#c69c61');rect(c,95,90,3,4,'#f5d777');
    for(const x of [3,141]){
      stone(c,x+2,35,32,72,'#c6d0bc');roof(c,x-3,12,42);
      rect(c,x+12,52,10,20,ink);rect(c,x+14,54,6,14,'#8abbbb');rect(c,x+14,54,2,12,'#c6e4d2');
      rect(c,x+16,0,3,16,'#5e5755');poly(c,[[x+19,0],[x+39,5],[x+19,11]],'#e5a946');
      rect(c,x+8,95,20,4,'#a2b29f');
    }
    rect(c,71,50,11,16,ink);rect(c,74,52,5,11,'#86b3b1');rect(c,99,50,11,16,ink);rect(c,102,52,5,11,'#86b3b1');
    rect(c,59,111,63,5,'#d8bd7a');rect(c,67,107,47,5,'#e6cf8c');
  }
  function zombie(c,z,time){
    const d=Z.MONSTERS[z.kind],bob=Math.sin(time*8+z.id)*1.5,sc=z.kind==='big'?1.22:.92;
    c.save();c.translate(0,bob);c.scale(sc,sc);shadow(c,0,13,14,4);
    const color=z.flash>0?'#e4efbd':z.slow>0?'#9ed5dc':d.color;
    rect(c,-9,-6,18,21,ink);rect(c,-7,-4,14,17,z.kind==='big'?'#9c729e':'#8d7b9d');
    rect(c,-11,8,7,10,'#596d64');rect(c,4,8,7,10,'#596d64');
    rect(c,-13,-20,26,21,ink);rect(c,-11,-18,22,17,color);rect(c,-8,-17,6,3,'#bfdc86');
    rect(c,-8,-12,6,6,'#fff3d2');rect(c,3,-12,6,6,'#fff3d2');rect(c,-5,-10,3,4,ink);rect(c,4,-10,3,4,ink);
    rect(c,-5,-3,13,3,ink);rect(c,-2,-3,3,3,'#f1e6ca');rect(c,5,-3,3,3,'#f1e6ca');
    rect(c,-17,-3,9,6,color);rect(c,8,-1,9,6,color);
    if(z.kind==='speedy'){rect(c,-14,-23,28,8,ink);rect(c,-12,-23,24,6,'#aeb6b1');rect(c,-8,-27,16,5,'#d2d5bc');rect(c,2,-22,4,4,'#e5d34c');}
    if(z.kind==='flying'){const flap=Math.sin(time*12)*5;poly(c,[[-11,-12],[-27,-22+flap],[-23,-3],[-10,0]],'#d4ddc3');poly(c,[[11,-12],[27,-22+flap],[23,-3],[10,0]],'#d4ddc3');}
    if(z.kind==='big'){rect(c,-7,-23,13,4,'#705574');rect(c,-12,-20,5,4,'#705574');}
    c.restore();
  }
  class Renderer{
    constructor(canvas,game){this.canvas=canvas;this.c=canvas.getContext('2d');this.game=game;this.hover=null;this.selected='wood';this.effects=[];this.time=0;this.makeGround();}
    makeGround(){
      const cv=document.createElement('canvas');cv.width=900;cv.height=600;const c=cv.getContext('2d');
      let seed=8731;const rand=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
      for(let y=0;y<10;y++)for(let x=0;x<15;x++){
        rect(c,x*60,y*60,60,60,this.game.world.ground[(x+y)%2]);
        for(let k=0;k<9;k++){const xx=x*60+rand()*55,yy=y*60+rand()*55;rect(c,xx,yy,3,2,rand()>.5?'#93b775':'#c0d799');}
        c.strokeStyle='#7b9d651e';c.lineWidth=1;c.strokeRect(x*60+.5,y*60+.5,59,59);
      }
      // Tiny meadow flowers decorate the corners without hiding a buildable square.
      for(let i=0;i<24;i++){const x=rand()*900,y=rand()*600;if(x>170&&x<730&&y>100&&y<500)continue;rect(c,x,y,2,6,'#6d9e66');rect(c,x-2,y,6,2,i%2?'#f7e6a4':'#e8d1dc');rect(c,x,y-2,2,6,i%2?'#f7e6a4':'#e8d1dc');}
      this.ground=cv;this.groundWorld=this.game.worldIndex;
    }
    event(e){
      if(e.type==='reset'||e.type==='loaded'){this.effects=[];return;}
      if(e.type==='shot')this.effects.push({...e,life:.23,max:.23});
      if(e.type==='defeat')this.effects.push({...e,life:1,max:1,text:'+'+e.reward,color:'#f9e590'});
      if(e.type==='place'||e.type==='remove'||e.type==='crumble')for(let i=0;i<7;i++)this.effects.push({type:'particle',x:e.x,y:e.y,vx:(Math.random()-.5)*2,vy:-Math.random()*2,color:e.type==='place'?'#f9e8a4':'#a97e52',life:.5,max:.5});
      if(e.type==='castleHit')this.effects.push({...e,life:.2,max:.2});
    }
    draw(dt){
      if(this.groundWorld!==this.game.worldIndex)this.makeGround();
      this.time+=dt;const c=this.c,g=this.game;c.imageSmoothingEnabled=false;c.drawImage(this.ground,0,0);
      for(let y=0;y<10;y++)for(let x=0;x<15;x++){
        const b=g.get(x,y);if(!b)continue;c.save();c.translate(x*60,y*60);sprite(c,b.type,b,this.time);if(b.upgrades?.skyWatch){rect(c,44,4,9,9,'#f3dc87');rect(c,47,6,3,5,ink);}c.restore();
        const max=Z.BUILDINGS[b.type].hp;
        if(max){rect(c,x*60+10,y*60+54,40,4,'#425d4e');rect(c,x*60+11,y*60+55,38*b.hp/max,2,b.hp/max<.3?'#dc755d':'#d7e9a9');}
      }
      c.save();c.translate(360,240);castle(c,this.time);c.restore();
      const zombies=[...g.zombies].sort((a,b)=>a.y-b.y);
      for(const z of zombies){c.save();c.translate(z.x*60,z.y*60);zombie(c,z,this.time);c.restore();if(z.hp<z.maxHp){rect(c,z.x*60-14,z.y*60-32,28,4,'#45604a');rect(c,z.x*60-13,z.y*60-31,26*z.hp/z.maxHp,2,z.slow>0?'#a1e8ef':'#d2e89c');}}
      if(this.hover){
        const {x,y}=this.hover,b=g.get(x,y),d=Z.BUILDINGS[this.selected];
        if(d?.range){c.fillStyle='#f6f0d918';c.strokeStyle='#f8f4d4aa';c.setLineDash([5,5]);c.beginPath();c.arc((x+.5)*60,(y+.5)*60,d.range*60,0,Math.PI*2);c.fill();c.stroke();c.setLineDash([]);}
        const ok=d?!g.canPlace(this.selected,x,y):this.selected==='remove'?!!b:b?.type==='bridge';
        rect(c,x*60+1,y*60+1,58,58,ok?'#f7efba55':'#bd615b44');
        c.strokeStyle=ok?'#fff5bb':'#d36d5b';c.lineWidth=3;c.strokeRect(x*60+2,y*60+2,56,56);
        if(d&&ok){c.save();c.globalAlpha=.68;c.translate(x*60,y*60);sprite(c,this.selected,{},this.time);c.restore();}
        if(b&&Z.BUILDINGS[b.type].hp){c.font='bold 10px monospace';c.textAlign='center';c.fillStyle=ink;c.fillText(Math.ceil(b.hp)+'/'+Z.BUILDINGS[b.type].hp+' HP',x*60+30,y*60+11);}
        if(b?.type==='bridge'){c.font='bold 11px sans-serif';c.textAlign='center';c.fillStyle=ink;c.fillText(b.raised?'RAISED':'LOWERED',x*60+30,y*60+59);}
      }
      for(const e of this.effects){
        e.life-=dt;if(e.type==='shot'){
          const p=1-e.life/e.max,x=(e.x+(e.tx-e.x)*p)*60,y=(e.y+(e.ty-e.y)*p)*60;
          if(e.kind==='archer'){c.strokeStyle='#685339';c.lineWidth=3;c.beginPath();c.moveTo(x-7,y+3);c.lineTo(x+5,y-3);c.stroke();rect(c,x+3,y-5,4,4,'#f0e5bb');}
          else {const col=e.kind==='fire'?'#ffd168':'#d0f8f2';rect(c,x-5,y-5,10,10,col);rect(c,x-3,y-7,6,14,col);}
        }else if(e.type==='defeat'){c.globalAlpha=Math.min(1,e.life*3);c.font='bold 20px monospace';c.textAlign='center';c.strokeStyle='#576747';c.lineWidth=3;const y=e.y*60-20-(1-e.life)*30;c.strokeText(e.text,e.x*60,y);c.fillStyle=e.color;c.fillText(e.text,e.x*60,y);c.globalAlpha=1;}
        else if(e.type==='particle'){e.x+=e.vx*dt;e.y+=e.vy*dt;e.vy+=dt*6;rect(c,e.x*60,e.y*60,5,5,e.color);}
        else if(e.type==='castleHit')rect(c,362,242,176,116,'#ef86633b');
      }
      this.effects=this.effects.filter(e=>e.life>0);
      if(g.paused&&['wave','countdown'].includes(g.phase)){rect(c,0,0,900,600,'#304a3b55');c.fillStyle='#fff6da';c.font='bold 36px sans-serif';c.textAlign='center';c.fillText('Kingdom paused',450,290);c.font='18px sans-serif';c.fillText('Press Space or Resume to keep defending',450,326);}
    }
  }
  Z.drawSprite=sprite;Z.drawCastle=castle;Z.Renderer=Renderer;
})(window.ZCD);
