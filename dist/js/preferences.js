(function(Z){
  'use strict';
  const KEY='frederiks-castle-defense.family-v2.toolbar';
  class Settings{
    constructor(storage){this.storage=storage;}
    backend(){return this.storage||localStorage;}
    get(key,fallback=null){try{const raw=this.backend().getItem(key);return raw===null?fallback:JSON.parse(raw);}catch{return fallback;}}
    put(key,value){
      try{
        const raw=JSON.stringify(value),storage=this.backend();
        const verify=()=>storage.getItem(key)===raw?{ok:true}:{ok:false,message:'Preferences could not be verified.'};
        const result=storage.setItem(key,raw);
        return result&&typeof result.then==='function'?result.then(verify).catch(()=>({ok:false,message:'Could not save preferences.'})):verify();
      }catch{return {ok:false,message:'Could not save preferences. Check browser storage.'};}
    }
  }
  class Toolbar{
    constructor(settings){this.settings=settings;const saved=settings.get(KEY);this.items=this.normalize(saved?.version===1?saved.items:Object.keys(Z.BUILDINGS).filter(Z.constructionAvailable).slice(0,8));}
    normalize(items){return Array.isArray(items)?[...new Set(items.filter(id=>typeof id==='string'&&Z.constructionAvailable(id)))].slice(0,8):Object.keys(Z.BUILDINGS).filter(Z.constructionAvailable).slice(0,8);}
    change(items){
      if(this.pending)return {ok:false,message:'Preferences are still saving. Try again in a moment.'};this.pending=true;
      const next=this.normalize(items),result=this.settings.put(KEY,{version:1,items:next});
      const apply=r=>{this.pending=false;if(r.ok)this.items=next;return r;};return result&&typeof result.then==='function'?result.then(apply):apply(result);
    }
    add(id){if(!Z.constructionAvailable(id))return {ok:false,message:'This building is unavailable.'};if(this.items.includes(id))return {ok:true};if(this.items.length>=8)return {ok:false,message:'Your toolbar has eight favorites. Remove one first.'};return this.change([...this.items,id]);}
    remove(id){return this.change(this.items.filter(item=>item!==id));}
    move(id,offset){const from=this.items.indexOf(id),to=from+offset;if(from<0||to<0||to>=this.items.length)return {ok:false,message:'Already at the edge.'};const next=[...this.items];[next[from],next[to]]=[next[to],next[from]];return this.change(next);}
  }
  Z.Settings=Settings;Z.Toolbar=Toolbar;Z.TOOLBAR_KEY=KEY;
})(window.ZCD);
