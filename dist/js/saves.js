/* Two independently verified generations per slot. Legacy storage is read-only. */
(function(Z){
  'use strict';
  const PREFIX='frederiks-castle-defense.family-v2.', READ_PREFIX='frederiks-zombie-castle.saves.', FORMAT=1;
  const keys=['auto.a','auto.b','manual.a','manual.b'];
  function checksum(text){let n=2166136261;for(let i=0;i<text.length;i++){n^=text.charCodeAt(i);n=Math.imul(n,16777619);}return (n>>>0).toString(16);}
  class SaveStore {
    constructor(storage){this.storage=storage;this.token=null;}
    backend(){return this.storage||localStorage;}
    parse(raw,key){
      let body,payload;
      if(key===Z.SAVE_KEY){payload=raw;body={revision:0,savedAt:0,slot:'legacy'};}
      else {
        const e=JSON.parse(raw);
        if(e.format!==FORMAT)throw Error('Unsupported storage format');
        body=e.body;
        if(!body||e.checksum!==checksum(JSON.stringify(body))||!Number.isSafeInteger(body.revision)||body.revision<1||!Number.isFinite(body.savedAt)||!['auto','manual','checkpoint'].includes(body.slot)||![PREFIX,READ_PREFIX].some(p=>key.startsWith(p+body.slot+'.')))throw Error('Invalid record');
        payload=body.payload;
      }
      const game=new Z.Game({starter:false});
      if(!game.importSave(payload).ok)throw Error('Invalid snapshot');
      return {key,raw,...body,payload:game.exportSave()};
    }
    inspect(){
      try {
        const storage=this.backend(),names=[...keys.map(k=>PREFIX+k),...keys.map(k=>READ_PREFIX+k),Z.SAVE_KEY];
        for(let i=0;i<storage.length;i++){const key=storage.key(i);if((key?.startsWith(PREFIX+'checkpoint.')||key?.startsWith(READ_PREFIX+'checkpoint.')))names.push(key);}
        const pairs=names.map(k=>[k,storage.getItem(k)]);
        const records=[],invalid=[];let future=false;
        for(const [key,raw] of pairs){
          if(raw===null)continue;
          try{records.push(this.parse(raw,key));}
          catch {
            invalid.push({key,raw});
            try{const e=JSON.parse(raw);const s=key===Z.SAVE_KEY?e:JSON.parse(e.body?.payload||'null');if((key!==Z.SAVE_KEY&&typeof e.format==='number'&&e.format>FORMAT)||s?.version>Z.SAVE_VERSION)future=true;}catch{}
          }
        }
        records.sort((a,b)=>b.revision-a.revision||b.savedAt-a.savedAt);
        const token=checksum(JSON.stringify(pairs));
        if(this.token===null)this.token=token;
        return {ok:true,records,invalid,future,token};
      }catch{return {ok:false,records:[],invalid:[],message:'Browser storage is unavailable. Export your kingdom to keep it.'};}
    }
    accept(){const state=this.inspect();if(state.ok)this.token=state.token;return state;}
    write(slot,game){
      try {
        if(this.readOnly)return {ok:false,message:this.readOnly};
        if(!['auto','manual','checkpoint'].includes(slot))throw Error('Invalid slot');
        const state=this.inspect();if(!state.ok)return state;
        if(state.future)return {ok:false,message:'A newer save format exists. Update the game before saving; existing data is untouched.'};
        if(state.token!==this.token)return {ok:false,conflict:true,message:'Another tab changed your saves. Reload to choose the latest progress; export this battlefield first.'};
        const storage=this.backend(),payload=game.exportSave();
        const check=new Z.Game({starter:false});if(!check.importSave(payload).ok)throw Error('Invalid battlefield');
        const candidates=state.records.filter(r=>r.slot===slot&&r.key.startsWith(PREFIX));
        const newest=candidates[0];
        const target=slot==='checkpoint'?PREFIX+'checkpoint.'+Date.now()+'.'+(state.records[0]?.revision+1||1):PREFIX+slot+'.'+(newest?.key.endsWith('.a')?'b':'a');
        if(slot==='checkpoint'&&storage.getItem(target)!==null)throw Error('Checkpoint collision');
        const revision=Math.max(0,...state.records.map(r=>r.revision))+1;
        // Preserve unreadable data before reusing an inactive generation.
        const damaged=state.invalid.find(r=>r.key===target);
        if(damaged){
          const quarantine=PREFIX+'recovery.'+Date.now()+'.'+revision;
          if(storage.getItem(quarantine)!==null)throw Error('Recovery collision');
          storage.setItem(quarantine,damaged.raw);
          if(storage.getItem(quarantine)!==damaged.raw)throw Error('Backup failed');
        }
        const body={slot,revision,savedAt:Date.now(),payload};
        const raw=JSON.stringify({format:FORMAT,body,checksum:checksum(JSON.stringify(body))});
        storage.setItem(target,raw);
        const read=storage.getItem(target);
        if(read!==raw)throw Error('Write verification failed');
        this.parse(read,target);
        this.token=this.inspect().token;
        return {ok:true,message:slot==='auto'?'Autosaved':'Manual save verified',revision};
      } catch {return {ok:false,message:'Save failed. Previous generations are retained. Export your kingdom and check browser storage.'};}
    }
  }
  Z.SaveStore=SaveStore;Z.SAVE_PREFIX=PREFIX;
})(window.ZCD);
