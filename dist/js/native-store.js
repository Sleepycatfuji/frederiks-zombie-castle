/* Capacitor Preferences adapter. A success requires a native read-back, not just a cache write. */
(function(Z){
  'use strict';
  class MemoryStorage{
    constructor(entries=[]){this.values=new Map(entries);}
    get length(){return this.values.size;}
    key(i){return [...this.values.keys()][i]??null;}
    getItem(key){return this.values.get(key)??null;}
    setItem(key,value){this.values.set(key,String(value));}
  }
  const owned=key=>key.startsWith(Z.SAVE_PREFIX)||key.startsWith('frederiks-zombie-castle.saves.')||key===Z.SAVE_KEY;
  class NativeSaveStore extends Z.SaveStore{
    static async open(preferences){
      const store=new NativeSaveStore(new MemoryStorage());store.preferences=preferences;store.queue=Promise.resolve();
      await store.refresh();store.native=true;return store;
    }
    async refresh(){
      const {keys}=await this.preferences.keys();const entries=[];
      for(const key of keys.filter(owned)){const {value}=await this.preferences.get({key});if(value!==null)entries.push([key,value]);}
      this.storage=new MemoryStorage(entries);this.token=null;this.inspect();
    }
    write(slot,game){
      const payload=game.exportSave();
      const perform=async()=>{
        try{
          if(this.readOnly)return {ok:false,message:this.readOnly};
          const snapshot=new Z.Game({starter:false});if(!snapshot.importSave(payload).ok)throw Error('Invalid snapshot');
          const trial=new Z.SaveStore(new MemoryStorage(this.storage.values));trial.token=this.token;
          const result=trial.write(slot,snapshot);if(!result.ok)return result;
          const changes=[...trial.storage.values].filter(([k,v])=>this.storage.getItem(k)!==v);
          // Quarantine damaged bytes before replacing their inactive generation.
          changes.sort(([a],[b])=>Number(b.includes('.recovery.'))-Number(a.includes('.recovery.')));
          for(const [key,value] of changes){await this.preferences.set({key,value});const check=await this.preferences.get({key});if(check.value!==value)throw Error('Native read-back failed');}
          this.storage=trial.storage;this.token=trial.token;return result;
        }catch{
          try{await this.refresh();}catch{this.readOnly='Native storage is unavailable. Export your kingdom before closing.';}
          return {ok:false,message:'Native save failed. Previous generations are retained. Export your kingdom.'};
        }
      };
      const operation=this.queue.then(perform,perform);this.queue=operation;return operation;
    }
  }
  class NativeSettings extends MemoryStorage{
    static async open(preferences){
      const storage=new NativeSettings();storage.preferences=preferences;
      for(const key of (await preferences.keys()).keys.filter(k=>k.startsWith('frederiks-castle-defense.family-v2.')||k==='zombie-castle-audio-v1')){
        const {value}=await preferences.get({key});if(value!==null)storage.values.set(key,value);
      }return storage;
    }
    async setItem(key,value){await this.preferences.set({key,value});if((await this.preferences.get({key})).value!==value)throw Error('Native preferences failed');this.values.set(key,value);}
  }
  Z.NativeSettings=NativeSettings;Z.NativeSaveStore=NativeSaveStore;
})(window.ZCD);
