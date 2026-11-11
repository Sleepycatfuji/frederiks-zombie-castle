(function(Z){
  'use strict';
  const $=id=>document.getElementById(id),audio=new Z.Audio();
  let renderer,selected='wood',lastBuilding='wood',toastTimer,bannerTimer,modalPaused=false;
  const game=new Z.Game({emit:onEvent});
  renderer=new Z.Renderer($('game'),game);
  const buildingTypes=Object.keys(Z.BUILDINGS),buttons={};
  const settingsKey='zombie-castle-audio-v1';
  try{const p=JSON.parse(localStorage.getItem(settingsKey));if(p&&typeof p.sfx==='boolean'&&typeof p.music==='boolean'){audio.sfx=p.sfx;audio.music=p.music;}}catch{/* Storage is optional. */}
  function toast(message,error=false){
    const el=$('toast');el.textContent=message;el.className='toast visible'+(error?' error':'');
    clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),3400);
  }
  function banner(message){const el=$('wave-banner');el.textContent=message;el.classList.add('show');clearTimeout(bannerTimer);bannerTimer=setTimeout(()=>el.classList.remove('show'),2900);}
  function onEvent(e){
    renderer?.event(e);
    const sound={place:'place',remove:'remove',crumble:'remove',zombieHit:'zombieHit',defeat:'defeat',castleHit:'castleHit',wallHit:'wallHit',wave:'wave',victory:'victory',gameover:'gameover'}[e.type];
    if(sound)audio.play(sound);if(e.type==='shot')audio.play(e.kind);
    if(e.type==='defeat')audio.play('coin');
    if(e.type==='wave')banner('⚑ Wave '+e.wave+' — here come the zombies!');
    if(e.type==='victory'){
      banner('✦ Wave '+e.wave+' defended! +'+e.income+' coins');
      toast(`Brilliant defending! +${e.income} coins${e.mines?' (including '+e.mines*30+' from mines)':''}. Castle repaired +8.`);
    }
    if(e.type==='gameover'){
      $('over-summary').textContent=`You survived ${Math.max(0,game.wave-1)} waves and bonked ${game.kills} zombies!`;
      showDialog('over-dialog');
    }
  }
  function iconCanvas(type){
    const cv=document.createElement('canvas');cv.width=60;cv.height=60;cv.setAttribute('aria-hidden','true');
    const c=cv.getContext('2d');c.imageSmoothingEnabled=false;Z.drawSprite(c,type,{},0);return cv;
  }
  for(const [i,type] of buildingTypes.entries()){
    const d=Z.BUILDINGS[type],btn=document.createElement('button');btn.className='building-card';btn.dataset.building=type;
    btn.setAttribute('aria-label',`${d.name}, ${d.cost} coins. ${d.detail}. Shortcut ${i+1}`);btn.setAttribute('aria-pressed','false');
    const key=document.createElement('span');key.className='key-number';key.textContent=i+1;btn.append(key,iconCanvas(type));
    const name=document.createElement('span');name.className='building-name';name.textContent=d.short;btn.append(name);
    const cost=document.createElement('span');cost.className='building-cost';cost.innerHTML='<span class="mini-coin" aria-hidden="true"></span><span>'+d.cost+'</span>';btn.append(cost);
    btn.addEventListener('click',()=>select(type));$('building-palette').append(btn);buttons[type]=btn;
  }
  function select(type){
    selected=type;if(Z.BUILDINGS[type])lastBuilding=type;renderer.selected=type;
    for(const t of buildingTypes){buttons[t].classList.toggle('selected',type===t);buttons[t].setAttribute('aria-pressed',String(type===t));}
    for(const t of ['build','remove','bridge']){const active=t==='build'?!!Z.BUILDINGS[type]:t==='bridge'?type==='bridge-control':type===t;$('tool-'+t).classList.toggle('active',active);$('tool-'+t).setAttribute('aria-pressed',String(active));}
    const d=Z.BUILDINGS[type];
    $('selection-title').textContent=d?d.name:type==='remove'?'Make room for big ideas':'Raise or lower bridges';
    $('selection-description').textContent=d?d.description:type==='remove'?'Click any building to remove it. You get half of its cost back.':'Click a drawbridge to switch between a crossing and a zombie-blocking barrier.';
    $('selection-detail').textContent=d?d.detail:type==='remove'?'50% refund · castle stays safe':'Raised = blocks · lowered = crossing';
    $('selection-key').textContent=d?buildingTypes.indexOf(type)+1:type==='remove'?'R':'B';
  }
  $('tool-build').onclick=()=>select(lastBuilding);$('tool-remove').onclick=()=>select('remove');
  // Distinct tool key: "bridge" itself is a buildable item in the registry.
  function selectBridge(){select('bridge-control');}
  $('tool-bridge').onclick=selectBridge;
  function cellFromEvent(e){const r=$('game').getBoundingClientRect();return {x:Math.max(0,Math.min(14,Math.floor((e.clientX-r.left)/r.width*15))),y:Math.max(0,Math.min(9,Math.floor((e.clientY-r.top)/r.height*10)))};}
  function act(cell,forceRemove=false){
    if(!cell)return;
    const result=forceRemove||selected==='remove'?game.remove(cell.x,cell.y):selected==='bridge-control'?game.toggleBridge(cell.x,cell.y):game.place(selected,cell.x,cell.y);
    if(!result.ok||selected==='bridge-control'||forceRemove||selected==='remove')toast(result.message,!result.ok);
    updateUI();
  }
  $('game').addEventListener('pointermove',e=>renderer.hover=cellFromEvent(e));
  $('game').addEventListener('pointerleave',()=>renderer.hover=null);
  $('game').addEventListener('click',e=>act(cellFromEvent(e)));
  $('game').addEventListener('contextmenu',e=>{e.preventDefault();act(cellFromEvent(e),true);});
  $('game').addEventListener('focus',()=>{if(!renderer.hover)renderer.hover={x:4,y:4};});
  function showDialog(id){
    const d=$(id);if(d.open)return;
    if(!document.querySelector('dialog[open]')){modalPaused=game.paused;game.paused=true;}
    d.showModal();
  }
  function closeAll(){for(const d of document.querySelectorAll('dialog[open]'))d.close();}
  for(const d of document.querySelectorAll('dialog')){
    for(const b of d.querySelectorAll('.close-dialog,.close-action'))b.onclick=()=>d.close();
    d.addEventListener('close',()=>{if(!document.querySelector('dialog[open]')){game.paused=modalPaused;updateUI();}});
    if(d.id==='over-dialog')d.addEventListener('cancel',e=>e.preventDefault());
  }
  $('help').onclick=$('shortcuts').onclick=()=>showDialog('help-dialog');
  $('mode').onclick=()=>showDialog('mode-dialog');
  for(const [id,creative] of [['survival-mode',false],['creative-mode',true]])$(id).onclick=()=>{game.creative=creative;$('mode-dialog').close();toast(creative?'Creative Mode! Build with unlimited coins.':'Survival Mode! Make every coin count.');updateUI();};
  $('save').onclick=()=>{const r=game.save();toast(r.message,!r.ok);};
  $('load').onclick=$('over-load').onclick=()=>showDialog('load-dialog');
  $('confirm-load').onclick=()=>{
    const r=game.load();toast(r.message,!r.ok);
    if(r.ok){modalPaused=false;closeAll();renderer.hover=null;updateUI();if(game.phase==='over')onEvent({type:'gameover'});}
    else $('load-dialog').close();
  };
  $('difficulty').onchange=()=>{game.difficulty=$('difficulty').value;toast('Difficulty changed for newly arriving zombies. Press Save to remember it.');};
  $('export-save').onclick=()=>{
    const url=URL.createObjectURL(new Blob([game.exportSave()],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download='frederiks-zombie-castle-save.json';link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Kingdom exported. Keep the downloaded JSON file safe.');
  };
  let pendingImport=null;
  $('import-save').onclick=()=>{ $('save-file').value='';$('save-file').click(); };
  $('save-file').onchange=async()=>{
    const file=$('save-file').files[0];if(!file)return;
    try {
      if(file.size>5*1024*1024)throw Error('Large file');
      const raw=await file.text(),candidate=new Z.Game({starter:false});
      if(!candidate.importSave(raw).ok)throw Error('Invalid save');
      pendingImport=raw;
      $('import-summary').textContent=`Wave ${candidate.wave}, ${candidate.coins} coins, ${candidate.cells.filter(Boolean).length} buildings, ${candidate.difficulty} difficulty.`;
      showDialog('import-dialog');
    } catch {pendingImport=null;toast('This file is not a valid kingdom save. Your current kingdom is safe.',true);}
  };
  $('confirm-import').onclick=()=>{
    if(!pendingImport)return;
    const result=game.importSave(pendingImport);pendingImport=null;
    if(result.ok){modalPaused=false;closeAll();renderer.hover=null;updateUI();if(game.phase==='over')onEvent({type:'gameover'});}
    toast(result.ok?'Kingdom imported! Press Save to keep it in this browser.':result.message,!result.ok);
  };
  $('new-game').onclick=()=>showDialog('new-dialog');
  function newGame(){const creative=game.creative,difficulty=game.difficulty;game.reset();game.creative=creative;game.difficulty=difficulty;modalPaused=false;closeAll();select('wood');renderer.hover=null;updateUI();toast('A fresh adventure awaits! Your starter defenses are ready.');}
  $('confirm-new').onclick=$('restart').onclick=newGame;
  $('start-wave').onclick=()=>{game.startWave();updateUI();};
  $('pause').onclick=()=>{if(game.phase==='wave'){game.paused=!game.paused;updateUI();}};
  $('speed').onclick=()=>{game.speed=game.speed===1?2:1;updateUI();};
  function updateAudio(){
    for(const [id,value,label] of [['sfx',audio.sfx,'Sound'],['music',audio.music,'Music']]){$(id).setAttribute('aria-pressed',String(value));$(id).querySelector('span').textContent=label+(value?' on':' off');}
  }
  function saveAudio(){try{localStorage.setItem(settingsKey,JSON.stringify({sfx:audio.sfx,music:audio.music}));}catch{}updateAudio();}
  $('sfx').onclick=()=>{audio.toggleSfx();saveAudio();if(audio.sfx)audio.play('place');};
  $('music').onclick=()=>{audio.toggleMusic();saveAudio();};
  const unlock=()=>{audio.unlock().then(ok=>{if(!ok)toast('Audio is unavailable in this browser. You can still play.');});};
  document.addEventListener('pointerdown',unlock,{once:true,capture:true});
  document.addEventListener('keydown',unlock,{once:true,capture:true});
  document.addEventListener('visibilitychange',()=>{
    audio.visibility(document.hidden).catch(()=>{});
    if(document.hidden&&game.phase==='wave')game.paused=true;
    updateUI();
  });
  document.addEventListener('keydown',e=>{
    if(document.querySelector('dialog[open]'))return;
    if(e.ctrlKey||e.metaKey||e.altKey||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;
    const k=e.key.toLowerCase();
    if(k>='1'&&k<='8'){select(buildingTypes[Number(k)-1]);return;}
    if(k==='r'){select('remove');return;}if(k==='b'){selectBridge();return;}
    if(k==='h'||k==='?'){showDialog('help-dialog');return;}if(k==='escape'){select(lastBuilding);return;}
    if(k===' '){if(e.target.tagName==='BUTTON')return;e.preventDefault();if(game.phase==='build')game.startWave();else if(game.phase==='wave')game.paused=!game.paused;updateUI();return;}
    const dirs={arrowleft:[-1,0],arrowright:[1,0],arrowup:[0,-1],arrowdown:[0,1]};
    if(dirs[k]){e.preventDefault();const p=renderer.hover||{x:4,y:4};const [dx,dy]=dirs[k];renderer.hover={x:Math.max(0,Math.min(14,p.x+dx)),y:Math.max(0,Math.min(9,p.y+dy))};$('game').focus({preventScroll:true});}
    if(k==='enter'&&e.target===$('game')){e.preventDefault();act(renderer.hover);}
  });
  const cache={};function write(id,text){if(cache[id]!==text){$(id).innerHTML=text;cache[id]=text;}}
  function updateUI(){
    $('difficulty').value=game.difficulty;
    write('health',Math.ceil(game.hp)+'<span> / 100</span>');$('health-fill').style.width=game.hp+'%';
    write('coins',game.creative?'∞ <span>coins</span>':Math.floor(game.coins).toLocaleString()+' <span>coins</span>');
    const mines=game.cells.filter(b=>b?.type==='mine').length;write('mine-income','+'+mines*30+' / wave');
    write('wave',String(game.phase==='build'?game.wave+1:game.wave).padStart(2,'0')+' <span>'+(game.phase==='build'?'up next':game.phase==='over'?'castle fell':'in progress')+'</span>');
    write('kills',game.kills+' zombies bonked');write('mode-name',(game.creative?'Creative':'Survival')+' <span>⌄</span>');
    write('mode-note',game.creative?'Unlimited imagination & coins':'Make every coin count');
    write('phase-badge',game.phase==='build'?'BUILD & PREPARE':game.phase==='over'?'CASTLE DOWN':game.paused?'TAKING A BREATHER':'DEFEND THE CASTLE');
    $('phase-badge').classList.toggle('attacking',game.phase==='wave');
    $('start-wave').disabled=game.phase!=='build';$('start-wave').querySelector('span').textContent=game.phase==='build'?'Start wave '+(game.wave+1):game.phase==='over'?'Castle down':'Wave in progress';
    $('pause').disabled=game.phase!=='wave';write('pause',(game.paused?'▶ <span>Resume</span>':'Ⅱ <span>Pause</span>'));write('speed',game.speed+'× speed');
    if(game.phase==='wave'){
      write('battle-title',game.paused?'A little royal break.':'Wave '+game.wave+' is here!');
      write('battle-hint',(game.remaining+game.zombies.length)+' / '+game.waveTotal+' zombies left · Keep building while your towers defend.');
    }else if(game.phase==='over'){write('battle-title','A brave little kingdom.');write('battle-hint','Start a new adventure and try another clever defense.');}
    else if(game.wave>0){write('battle-title','Hooray! Wave '+game.wave+' defended.');write('battle-hint','You earned '+game.lastIncome+' bonus coins. Build bigger before the next wave!');}
    else{write('battle-title','Ready, Sir Frederik?');write('battle-hint','Build your defenses, then send in the silly zombies.');}
    for(const type of buildingTypes){buttons[type].classList.toggle('unaffordable',!game.creative&&game.coins<Z.BUILDINGS[type].cost);const cost=buttons[type].querySelector('.building-cost span:last-child');cost.textContent=game.creative?'∞':Z.BUILDINGS[type].cost;}
  }
  const bc=$('brand-castle').getContext('2d');bc.imageSmoothingEnabled=false;bc.scale(.34,.34);bc.translate(1,22);Z.drawCastle(bc,0);
  select('wood');updateUI();updateAudio();
  let prev=performance.now(),uiClock=0;
  function frame(now){const dt=Math.min(.05,(now-prev)/1000);prev=now;game.update(dt);renderer.draw(game.paused?0:dt);uiClock+=dt;if(uiClock>.1){updateUI();uiClock=0;}requestAnimationFrame(frame);}
  requestAnimationFrame(frame);
  // Useful for local debugging and extending the game; never enables cheats automatically.
  window.zombieCastle={game,audio,renderer};
})(window.ZCD);
