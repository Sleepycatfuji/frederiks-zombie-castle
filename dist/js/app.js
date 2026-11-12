function bootCastle(Z){
  'use strict';
  const $=id=>document.getElementById(id),audio=new Z.Audio();
  let renderer,selected='wood',lastBuilding='wood',toastTimer,bannerTimer,modalPaused=false;
  const game=new Z.Game({emit:onEvent});
  const saves=Z.native?.store||new Z.SaveStore();
  function settle(value,next){return value&&typeof value.then==='function'?value.then(next):next(value);}
  // Hold a write lock for this page, and release it before navigation/BFCache.
  let releaseSaveLock=()=>{},lockPending=false;
  function acquireSaveLock(){
    if(Z.native||!window.navigator?.locks||lockPending)return;
    lockPending=true;saves.readOnly='Opening save storage. Try again in a moment.';
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),1000);
    window.navigator.locks.request('frederiks-zombie-castle-writer',{signal:controller.signal},lock=>{
      clearTimeout(timeout);lockPending=false;saves.readOnly=null;if(started)requestSave();
      return new Promise(resolve=>{releaseSaveLock=()=>{resolve();saves.readOnly='This page is inactive. Reload before saving.';};});
    }).catch(()=>{clearTimeout(timeout);lockPending=false;saves.readOnly='Another game tab is open. Close it and reload this tab before saving.';saveStatus({ok:false,message:saves.readOnly});});
  }
  let started=false,autoPending=false,lastAuto=0,recoveryRecords=[];
  function saveStatus(result){$('save-status').textContent=result.message; $('save-status').className=result.ok?'save-ok':'save-error';}
  function autosave(){if(!started)return {ok:true};autoPending=false;return settle(saves.write('auto',game),r=>{saveStatus(r);return r;});}
  function requestSave(){if(!started||autoPending)return;autoPending=true;$('save-status').textContent='Saving…';$('save-status').className='';setTimeout(()=>{if(autoPending)autosave();},0);}
  function protectCurrent(preserveLatest=false){let source=game;if(!started){if(!preserveLatest)return true;const state=saves.inspect();if(!state.ok){saveStatus(state);return false;}if(!state.records.length)return true;source=new Z.Game({starter:false});if(!source.importSave(state.records[0].payload).ok)return false;}return settle(saves.write('checkpoint',source),r=>{if(!r.ok){saveStatus(r);toast(r.message,true);}return r.ok;});}
  function restore(record){
    if(!record)return;return settle(protectCurrent(),ok=>{if(!ok)return;
    const r=game.importSave(record.payload);
    if(!r.ok){toast(r.message,true);return;}
    rememberScores();started=true;modalPaused=['wave','countdown'].includes(game.phase);closeAll();game.paused=modalPaused;renderer.hover=null;updateUI();autosave();
    if(game.phase==='over')onEvent({type:'gameover'});
    });
  }
  function recovery(){
    const state=saves.inspect();recoveryRecords=state.records;$('recovery-slot').textContent='';
    for(const [i,r] of recoveryRecords.entries()){const option=document.createElement('option');option.value=String(i);option.textContent=`${r.slot} · wave ${JSON.parse(r.payload).wave} · ${r.savedAt?new Date(r.savedAt).toLocaleString():'original save'}`;$('recovery-slot').append(option);}
    $('recovery-slot').value='0';$('confirm-load').disabled=!recoveryRecords.length;showDialog('load-dialog');
  }
  renderer=new Z.Renderer($('game'),game);
  const buildingTypes=Object.keys(Z.BUILDINGS),buttons={};
  const settings=new Z.Settings(Z.native?.settingsStorage),toolbar=new Z.Toolbar(settings);
  const board=new Z.Leaderboard(settings,window.ZCD_LEADERBOARD||{});
  const bestKey='frederiks-castle-defense.family-v2.personal-bests';
  const localBests=Object.create(null),storedBests=settings.get(bestKey,{});
  if(storedBests&&typeof storedBests==='object'&&!Array.isArray(storedBests))for(const [key,value] of Object.entries(storedBests))if(Number.isFinite(value)&&value>=0)localBests[key]=value;
  function rememberScores(){
    for(const [key,value] of Object.entries(game.highScores))if(Number.isFinite(value)&&value>=0)localBests[key]=Math.max(Number(localBests[key])||0,value);
    game.highScores={...localBests};
    settle(settings.put(bestKey,localBests),r=>{if(!r.ok)toast('Could not retain personal-best preferences. '+r.message,true);});
  }
  rememberScores();
  const settingsKey='zombie-castle-audio-v1';
  try{const p=JSON.parse(Z.native?Z.native.audio:localStorage.getItem(settingsKey));if(p&&typeof p.sfx==='boolean'&&typeof p.music==='boolean'){audio.sfx=p.sfx;audio.music=p.music;}}catch{/* Storage is optional. */}
  function toast(message,error=false){
    const el=$('toast');el.textContent=message;el.className='toast visible'+(error?' error':'');
    clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),3400);
  }
  function banner(message){const el=$('wave-banner');el.textContent=message;el.classList.add('show');clearTimeout(bannerTimer);bannerTimer=setTimeout(()=>el.classList.remove('show'),2900);}
  function onEvent(e){
    renderer?.event(e);
    if(['victory','gameover'].includes(e.type))rememberScores();
    if(['place','remove','victory','gameover','wave','crumble','defeat'].includes(e.type))requestSave();
    const sound={place:'place',remove:'remove',crumble:'remove',zombieHit:'zombieHit',defeat:'defeat',castleHit:'castleHit',wallHit:'wallHit',wave:'wave',victory:'victory',gameover:'gameover'}[e.type];
    if(sound)audio.play(e.type==='place'&&e.buildingType?Z.BUILDINGS[e.buildingType]?.sounds?.place||sound:sound);if(e.type==='shot')audio.play(Z.BUILDINGS[e.kind]?.sounds?.attack||e.kind);
    if(e.type==='defeat')audio.play('coin');
    if(e.type==='wave'&&e.wave===1)board.begin(game).catch(error=>toast(error.message,true));
    if(e.type==='wave')banner('⚑ Wave '+e.wave+' — here come the zombies!');
    if(e.type==='victory'){
      banner('✦ Wave '+e.wave+' defended! +'+e.income+' coins');
      toast(`Brilliant defending! +${e.income} coins${e.mines?' (including '+e.mines*30+' from mines)':''}. Castle repaired +8.`);
    }
    if(e.type==='gameover'){
      $('over-summary').textContent=`You survived ${Math.max(0,game.wave-1)} waves and bonked ${game.kills} zombies! ${game.world.name} · Score ${game.score()} · Best ${game.highScores[(game.creative?'creative':'survival')+':'+game.difficulty]||0}.`;
      const previous=game.savedExtras.onlineRun?.previousBest||0;
      $('over-summary').textContent+=' Previous personal best: '+previous+(game.score()>previous?' · New personal best!':'');
      $('online-result').textContent='Keeping your score…';
      board.finish(game).then(result=>{$('online-result').textContent=result.message;}).catch(error=>{$('online-result').textContent='Online submission failed: '+error.message;});
      showDialog('over-dialog');
    }
  }
  function iconCanvas(type){
    const cv=document.createElement('canvas');cv.width=60;cv.height=60;cv.setAttribute('aria-hidden','true');
    const c=cv.getContext('2d');c.imageSmoothingEnabled=false;Z.drawSprite(c,type,{},0);return cv;
  }
  function renderToolbar(){
  $('building-palette').textContent='';for(const key of Object.keys(buttons))delete buttons[key];
  for(const [i,type] of toolbar.items.entries()){
    const d=Z.BUILDINGS[type],btn=document.createElement('button');btn.className='building-card';btn.dataset.building=type;
    btn.setAttribute('aria-label',`${d.name}, ${d.cost} coins. ${d.detail}. Shortcut ${i+1}`);btn.setAttribute('aria-pressed','false');
    const key=document.createElement('span');key.className='key-number';key.textContent=i+1;btn.append(key,iconCanvas(type));
    const name=document.createElement('span');name.className='building-name';name.textContent=d.short;btn.append(name);
    const cost=document.createElement('span');cost.className='building-cost';cost.innerHTML='<span class="mini-coin" aria-hidden="true"></span><span>'+d.cost+'</span>';btn.append(cost);
    btn.addEventListener('click',()=>select(type));$('building-palette').append(btn);buttons[type]=btn;
  }
  if(!toolbar.items.includes(selected)&&Z.BUILDINGS[selected]){selected=toolbar.items[0]||'none';renderer.selected=selected;lastBuilding=selected;}
  }
  function select(type){
    selected=type;if(Z.BUILDINGS[type])lastBuilding=type;renderer.selected=type;
    for(const t of toolbar.items){buttons[t].classList.toggle('selected',type===t);buttons[t].setAttribute('aria-pressed',String(type===t));}
    for(const t of ['build','remove','bridge','upgrade']){const active=t==='build'?!!Z.BUILDINGS[type]:t==='bridge'?type==='bridge-control':type===t;$('tool-'+t).classList.toggle('active',active);$('tool-'+t).setAttribute('aria-pressed',String(active));}
    const d=Z.BUILDINGS[type];
    if(type==='none'){$('selection-title').textContent='Choose your favorites';$('selection-description').textContent='Open Building Inventory to add structures to your toolbar.';$('selection-detail').textContent='Placed structures stay safe when you change favorites.';$('selection-key').textContent='';return;}
    if(type==='upgrade'){ $('selection-title').textContent='Sky Watch · 40 coins';$('selection-description').textContent='Choose an archer tower: +0.6 range and +50% damage against flying zombies.';$('selection-detail').textContent='One upgrade per archer · locked between waves';$('selection-key').textContent='U';return;}
    $('selection-title').textContent=d?d.name:type==='remove'?'Make room for big ideas':'Raise or lower bridges';
    $('selection-description').textContent=d?d.description:type==='remove'?'Click any building to remove it. You get half of its cost back.':'Click a drawbridge to switch between a crossing and a zombie-blocking barrier.';
    $('selection-detail').textContent=d?d.detail:type==='remove'?'50% refund · castle stays safe':'Raised = blocks · lowered = crossing';
    $('selection-key').textContent=d?toolbar.items.indexOf(type)+1:type==='remove'?'R':'B';
  }
  let boardOffset=0;
  async function loadLeaderboard(more=false){
    if(!more){boardOffset=0;$('leaderboard-rows').textContent='';}
    $('leaderboard-status').textContent='Loading leaderboard…';$('more-scores').disabled=true;
    try{
      const data=await board.list($('leaderboard-difficulty').value,boardOffset);
      for(const score of data.scores){const row=document.createElement('tr');for(const value of [score.ranking,score.nickname,score.highest_wave,score.zombies,score.score,score.difficulty,new Date(score.achieved_at).toLocaleDateString()+(score.offline?' · offline':'')]){const cell=document.createElement('td');cell.textContent=String(value);row.append(cell);}$('leaderboard-rows').append(row);}
      boardOffset+=data.scores.length;$('more-scores').disabled=!data.more;
      $('leaderboard-status').textContent=data.scores.length?'Best result per player · '+$('leaderboard-difficulty').value:'No scores yet for this difficulty.';
    }catch(error){$('leaderboard-status').textContent=error.message;}
  }
  function openLeaderboard(){$('player-nickname').value=board.profile.nickname;showDialog('leaderboard-dialog');loadLeaderboard();}
  $('open-leaderboard').onclick=$('over-leaderboard').onclick=openLeaderboard;
  $('save-nickname').onclick=async()=>{try{await board.setNickname($('player-nickname').value);const result=await board.flush();$('leaderboard-status').textContent='Nickname remembered. '+result.message;}catch(error){$('leaderboard-status').textContent=error.message;}};
  $('retry-scores').onclick=async()=>{try{const result=await board.flush();$('leaderboard-status').textContent=result.message;}catch(error){$('leaderboard-status').textContent=error.message;}};
  $('leaderboard-difficulty').onchange=()=>loadLeaderboard();$('more-scores').onclick=()=>loadLeaderboard(true);
  window.addEventListener('online',()=>board.flush().then(result=>{if(result.message)$('online-result').textContent=result.message;}).catch(()=>{}));
  function inventoryAction(operation){settle(operation,r=>{
    $('toolbar-status').textContent=r.ok?'Toolbar preferences saved.':r.message;
    if(r.ok){renderToolbar();select(toolbar.items[0]||'none');updateUI();renderInventory();}
  });}
  function renderInventory(){
    $('toolbar-editor').textContent='';
    for(const [i,id] of toolbar.items.entries()){
      const row=document.createElement('div');row.className='toolbar-row';row.append(iconCanvas(id));
      const name=document.createElement('strong');name.textContent=(i+1)+'. '+Z.BUILDINGS[id].name;row.append(name);
      for(const [label,action,disabled] of [['Move earlier',()=>toolbar.move(id,-1),i===0],['Move later',()=>toolbar.move(id,1),i===toolbar.items.length-1],['Remove favorite',()=>toolbar.remove(id),false]]){
        const button=document.createElement('button');button.className='secondary-button';button.textContent=label;button.setAttribute('aria-label',label+' '+Z.BUILDINGS[id].name);button.disabled=disabled;button.onclick=()=>inventoryAction(action());row.append(button);
      }
      $('toolbar-editor').append(row);
    }
    $('inventory-catalogue').textContent='';
    for(const category of ['Defense','Attack','Resources','Special']){
      const section=document.createElement('section'),heading=document.createElement('h3');heading.textContent=category;section.append(heading);
      for(const [id,d] of Object.entries(Z.BUILDINGS).filter(([id,d])=>d.category===category&&Z.constructionAvailable(id))){
        const entry=document.createElement('div');entry.className='inventory-entry';entry.dataset.inventory=id;entry.append(iconCanvas(id));
        const details=document.createElement('div'),title=document.createElement('strong'),text=document.createElement('p');title.textContent=d.name+' · '+d.cost+' coins';text.textContent=(d.hp?d.hp+' HP':'Indestructible')+' · Limit '+d.limit+' · '+d.description+(d.unlockWave?' · Unlocks at wave '+d.unlockWave:'');details.append(title,text);entry.append(details);
        const add=document.createElement('button');add.className='secondary-button';add.textContent=toolbar.items.includes(id)?'In toolbar':'Add favorite';add.setAttribute('aria-label','Add '+d.name+' to toolbar');add.disabled=toolbar.items.includes(id)||toolbar.items.length>=8;add.onclick=()=>inventoryAction(toolbar.add(id));entry.append(add);section.append(entry);
      }
      $('inventory-catalogue').append(section);
    }
  }
  $('open-inventory').onclick=()=>{renderInventory();showDialog('inventory-dialog');};
  $('tool-build').onclick=()=>select(lastBuilding);$('tool-remove').onclick=()=>select('remove');
  // Distinct tool key: "bridge" itself is a buildable item in the registry.
  function selectBridge(){select('bridge-control');}
  $('tool-bridge').onclick=selectBridge;$('tool-upgrade').onclick=()=>select('upgrade');
  function cellFromEvent(e){const r=$('game').getBoundingClientRect();return {x:Math.max(0,Math.min(14,Math.floor((e.clientX-r.left)/r.width*15))),y:Math.max(0,Math.min(9,Math.floor((e.clientY-r.top)/r.height*10)))};}
  function act(cell,forceRemove=false){
    if(!cell)return;
    const result=forceRemove||selected==='remove'?game.remove(cell.x,cell.y):selected==='upgrade'?game.upgrade(cell.x,cell.y):selected==='bridge-control'?game.toggleBridge(cell.x,cell.y):game.place(selected,cell.x,cell.y);
    if(!result.ok||selected==='bridge-control'||selected==='upgrade'||forceRemove||selected==='remove')toast(result.message,!result.ok);
    updateUI();
  }
  let stroke=null,suppressNextClick=false,lastPointerType='mouse';
  function strokeTo(cell){
    if(!stroke)return;
    const from=stroke.last,steps=Math.max(Math.abs(cell.x-from.x),Math.abs(cell.y-from.y));
    for(let i=0;i<=steps;i++){
      const p={x:Math.round(from.x+(cell.x-from.x)*(steps?i/steps:0)),y:Math.round(from.y+(cell.y-from.y)*(steps?i/steps:0))},key=p.x+','+p.y;
      if(!stroke.seen.has(key)){stroke.seen.add(key);act(p);}
    }
    stroke.last=cell;
  }
  $('game').addEventListener('pointerdown',e=>{
    lastPointerType=e.pointerType||'mouse';suppressNextClick=false;
    if(e.button!==0||e.isPrimary===false||!Z.BUILDINGS[selected])return;
    if(game.modificationError()){toast(game.modificationError(),true);suppressNextClick=true;return;}
    const cell=cellFromEvent(e);stroke={id:e.pointerId,last:cell,seen:new Set()};
    $('game').setPointerCapture?.(e.pointerId);strokeTo(cell);
  });
  $('game').addEventListener('pointermove',e=>{
    const r=$('game').getBoundingClientRect();
    if(e.clientX<r.left||e.clientX>=r.left+r.width||e.clientY<r.top||e.clientY>=r.top+r.height)return;
    const cell=cellFromEvent(e);renderer.hover=cell;if(stroke?.id===e.pointerId)strokeTo(cell);
  });
  function endStroke(e){if(stroke&&e?.pointerId!==undefined&&stroke.id!==e.pointerId)return;if(stroke){stroke=null;suppressNextClick=true;}}
  $('game').addEventListener('pointerup',endStroke);$('game').addEventListener('pointercancel',endStroke);$('game').addEventListener('lostpointercapture',endStroke);
  $('game').addEventListener('pointerleave',()=>renderer.hover=null);
  $('game').addEventListener('click',e=>{if(suppressNextClick){suppressNextClick=false;return;}act(cellFromEvent(e));});
  $('game').addEventListener('contextmenu',e=>{e.preventDefault();if(lastPointerType==='mouse')act(cellFromEvent(e),true);});
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
    if(d.id==='over-dialog'||d.id==='continue-dialog')d.addEventListener('cancel',e=>e.preventDefault());
  }
  $('help').onclick=$('shortcuts').onclick=()=>showDialog('help-dialog');
  $('mode').onclick=()=>showDialog('mode-dialog');
  for(const [id,creative] of [['survival-mode',false],['creative-mode',true]])$(id).onclick=()=>{game.creative=creative;if(creative)board.invalidate(game,'Creative Mode was used.');$('mode-dialog').close();toast(creative?'Creative Mode! Build with unlimited coins.':'Survival Mode! Make every coin count.');updateUI();requestSave();};
  function manualSave(){return settle(saves.write('manual',game),r=>{saveStatus(r);toast(r.message,!r.ok);if(r.ok)$('save-confirm-dialog').close();});}
  $('save').onclick=()=>{
    const state=saves.inspect();
    if(!state.ok){saveStatus(state);return;}
    if(state.records.some(r=>r.slot==='manual'||r.slot==='legacy')||state.invalid.some(r=>r.key.includes('manual.')))showDialog('save-confirm-dialog');
    else manualSave();
  };
  $('confirm-save').onclick=manualSave;
  $('load').onclick=$('over-load').onclick=recovery;
  $('confirm-load').onclick=()=>restore(recoveryRecords[Number($('recovery-slot').value)]);
  $('difficulty').onchange=()=>{if(game.wave>0&&game.difficulty!==$('difficulty').value)board.invalidate(game,'Difficulty changed during the run.');game.difficulty=$('difficulty').value;requestSave();toast('Difficulty changed for newly arriving zombies.');};
  $('export-save').onclick=()=>{
    if(Z.native)return Z.native.exportFile(game.exportSave()).then(()=>toast('Save file shared.')).catch(()=>toast('Could not export the file. Try again.',true));
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
    return settle(protectCurrent(true),ok=>{if(!ok)return;
    const result=game.importSave(pendingImport);pendingImport=null;if(result.ok)board.invalidate(game,'Imported progress is local-only.');
    if(result.ok){rememberScores();started=true;modalPaused=['wave','countdown'].includes(game.phase);closeAll();game.paused=modalPaused;renderer.hover=null;updateUI();autosave();if(game.phase==='over')onEvent({type:'gameover'});}
    toast(result.ok?'Kingdom imported. Check the save indicator; manual saves are unchanged.':result.message,!result.ok);
    });
  };
  $('new-game').onclick=()=>showDialog('new-dialog');
  function newGame(){return settle(protectCurrent(true),ok=>{if(!ok)return;const creative=game.creative,difficulty=game.difficulty,highScores=game.highScores;game.reset();game.highScores=highScores;game.creative=creative;game.difficulty=difficulty;started=true;modalPaused=false;closeAll();select(toolbar.items[0]||'none');renderer.hover=null;updateUI();autosave();toast('A fresh adventure awaits! Your starter defenses are ready.');});}
  $('confirm-new').onclick=newGame;$('restart').onclick=()=>showDialog('new-dialog');
  $('start-wave').onclick=()=>{game.startWave();updateUI();};
  $('pause').onclick=()=>{if(['wave','countdown'].includes(game.phase)){game.paused=!game.paused;updateUI();}};
  $('speed').onclick=()=>{game.speed=game.speed===1?2:1;updateUI();};
  function updateAudio(){
    for(const [id,value,label] of [['sfx',audio.sfx,'Sound'],['music',audio.music,'Music']]){$(id).setAttribute('aria-pressed',String(value));$(id).querySelector('span').textContent=label+(value?' on':' off');}
  }
  function saveAudio(){const value=JSON.stringify({sfx:audio.sfx,music:audio.music});if(Z.native)Z.native.saveAudio(value).catch(()=>toast('Could not save sound preferences.',true));else try{localStorage.setItem(settingsKey,value);}catch{}updateAudio();}
  $('sfx').onclick=()=>{audio.toggleSfx();saveAudio();if(audio.sfx)audio.play('place');};
  $('music').onclick=()=>{audio.toggleMusic();saveAudio();};
  const unlock=()=>{audio.unlock().then(ok=>{if(!ok)toast('Audio is unavailable in this browser. You can still play.');});};
  document.addEventListener('pointerdown',unlock,{once:true,capture:true});
  document.addEventListener('keydown',unlock,{once:true,capture:true});
  document.addEventListener('visibilitychange',()=>{
    audio.visibility(document.hidden).catch(()=>{});
    if(document.hidden){if(['wave','countdown'].includes(game.phase))game.paused=true;autosave();}
    updateUI();
  });
  window.addEventListener('pagehide',()=>{autosave();releaseSaveLock();});
  window.addEventListener('pageshow',e=>{if(e.persisted)acquireSaveLock();});
  window.addEventListener('storage',()=>{const state=saves.inspect();if(state.ok&&state.token!==saves.token){game.paused=true;saveStatus({ok:false,message:'Saves changed in another tab. Export this battlefield or reload before saving.'});}});
  document.addEventListener('keydown',e=>{
    if(document.querySelector('dialog[open]'))return;
    if(e.ctrlKey||e.metaKey||e.altKey||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;
    const k=e.key.toLowerCase();
    if(k>='1'&&k<='8'){if(toolbar.items[Number(k)-1])select(toolbar.items[Number(k)-1]);return;}
    if(k==='u'){select('upgrade');return;}if(k==='r'){select('remove');return;}if(k==='b'){selectBridge();return;}
    if(k==='h'||k==='?'){showDialog('help-dialog');return;}if(k==='escape'){select(lastBuilding);return;}
    if(k===' '){if(e.target.tagName==='BUTTON')return;e.preventDefault();if(game.phase==='build'||(game.phase==='countdown'&&!game.paused))game.startWave();else if(['wave','countdown'].includes(game.phase))game.paused=!game.paused;updateUI();return;}
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
    write('wave',String(['build','countdown'].includes(game.phase)?game.wave+1:game.wave).padStart(2,'0')+' <span>'+(['build','countdown'].includes(game.phase)?'up next':game.phase==='over'?'castle fell':'in progress')+'</span>');
    write('kills',game.kills+' zombies bonked');write('mode-name',(game.creative?'Creative':'Survival')+' <span>⌄</span>');
    write('mode-note',game.creative?'Unlimited imagination & coins':'Make every coin count');
    write('world-name',game.world.name+' · Level '+Math.max(1,game.wave));
    write('phase-badge',game.phase==='countdown'?(game.paused?'PAUSED · ':'')+'BUILDING LOCKED · '+Math.ceil(game.countdown)+'s':game.phase==='build'?'BUILD & PREPARE':game.phase==='over'?'CASTLE DOWN':game.paused?'TAKING A BREATHER':'DEFEND THE CASTLE');
    for(const t of ['build','remove','bridge','upgrade'])$('tool-'+t).disabled=game.phase==='countdown';
    $('phase-badge').classList.toggle('attacking',game.phase==='wave');
    $('start-wave').disabled=!['build','countdown'].includes(game.phase)||game.paused;$('start-wave').querySelector('span').textContent=game.phase==='countdown'?'Start Wave Early':game.phase==='build'?'Start wave '+(game.wave+1):game.phase==='over'?'Castle down':'Wave in progress';
    $('pause').disabled=!['wave','countdown'].includes(game.phase);write('pause',(game.paused?'▶ <span>Resume</span>':'Ⅱ <span>Pause</span>'));write('speed',game.speed+'× speed');
    if(game.phase==='countdown'){write('battle-title','Next wave in '+Math.ceil(game.countdown)+' seconds');write('battle-hint','Building locked · '+(game.paused?'countdown paused':'prepare for the next invasion'));}
    else if(game.phase==='wave'){
      write('battle-title',game.paused?'A little royal break.':'Wave '+game.wave+' is here!');
      write('battle-hint',(game.remaining+game.zombies.length)+' / '+game.waveTotal+' zombies left · Keep building while your towers defend.');
    }else if(game.phase==='over'){write('battle-title','A brave little kingdom.');write('battle-hint','Start a new adventure and try another clever defense.');}
    else if(game.wave>0){write('battle-title','Hooray! Wave '+game.wave+' defended.');write('battle-hint','You earned '+game.lastIncome+' bonus coins. Build bigger before the next wave!');}
    else{write('battle-title','Ready, Sir Frederik?');write('battle-hint','Build your defenses, then send in the silly zombies.');}
    for(const type of toolbar.items){buttons[type].disabled=game.phase==='countdown'||!!Z.constructionError(type,game.wave);buttons[type].classList.toggle('unaffordable',!game.creative&&game.coins<Z.BUILDINGS[type].cost);const cost=buttons[type].querySelector('.building-cost span:last-child');cost.textContent=game.creative?'∞':Z.BUILDINGS[type].cost;}
  }
  const bc=$('brand-castle').getContext('2d');bc.imageSmoothingEnabled=false;bc.scale(.34,.34);bc.translate(1,22);Z.drawCastle(bc,0);
  renderToolbar();select(toolbar.items[0]||'none');updateUI();updateAudio();
  let prev=performance.now(),uiClock=0,lastSnapshot='';
  function frame(now){const dt=Math.min(.05,(now-prev)/1000);prev=now;game.update(dt);renderer.draw(game.paused?0:dt);uiClock+=dt;if(uiClock>.1){updateUI();uiClock=0;}if(started&&now-lastAuto>=1000){lastAuto=now;const current=game.exportSave();if(current!==lastSnapshot){settle(autosave(),r=>{if(r.ok)lastSnapshot=current;});}}requestAnimationFrame(frame);}
  requestAnimationFrame(frame);
  acquireSaveLock();
  const initial=saves.inspect();
  $('continue-game').disabled=!initial.records.length;
  $('continue-summary').textContent=!initial.ok?initial.message:initial.records.length?`Your latest valid kingdom is ready.${initial.invalid.length?' Some damaged saves were skipped; recovery copies are retained.':''}`:initial.invalid.length?'Saved data could not be read. It has not been deleted. Import a backup or choose a new kingdom.':'Start a kingdom or import your progress. Original saves will never be replaced.';
  $('continue-game').onclick=()=>{const state=saves.accept();restore(state.records[0]);};
  $('welcome-recovery').onclick=recovery;
  $('welcome-import').onclick=()=>$('import-save').click();
  $('welcome-new').onclick=()=>showDialog('new-dialog');
  showDialog('continue-dialog');
  if(Z.native){Z.native.App.addListener('appStateChange',({isActive})=>{audio.visibility(!isActive).catch(()=>{});if(!isActive){game.paused=true;autosave();}updateUI();});Z.native.App.addListener('backButton',()=>{game.paused=true;showDialog('help-dialog');});}
  // Useful for local debugging and extending the game; never enables cheats automatically.
  window.zombieCastle={game,audio,renderer,saves,settings,toolbar,board};
}
if(window.NativeReady)window.NativeReady.then(()=>bootCastle(window.ZCD)).catch(()=>{document.getElementById('save-status').textContent='Native storage unavailable. Your existing saves have not been changed.';});
else bootCastle(window.ZCD);
