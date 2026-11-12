/* Only score summaries leave the device. Kingdom saves never go to this service. */
(function(Z){
  'use strict';
  const KEY='frederiks-castle-defense.family-v2.online',RULES='family-v2-1';
  class Leaderboard{
    constructor(settings,config={},request=globalThis.fetch){
      this.settings=settings;this.config=config;this.request=request?.bind(globalThis);this.persistQueue=Promise.resolve();
      const saved=settings.get(KEY,{})||{};
      this.profile={nickname:typeof saved.nickname==='string'?saved.nickname:'',deviceId:typeof saved.deviceId==='string'?saved.deviceId:'',auth:saved.auth||null,pending:Array.isArray(saved.pending)?saved.pending:[],submitted:Array.isArray(saved.submitted)?saved.submitted:[]};
      this.enabled=!!config.url&&!!config.publicKey;
    }
    nickname(value){const name=value.trim();if(!/^[\p{L}\p{N} _-]{1,20}$/u.test(name))throw Error('Choose 1–20 letters, numbers, spaces, underscores or hyphens.');return name;}
    async persist(){const save=async()=>{const r=await this.settings.put(KEY,this.profile);if(!r.ok)throw Error(r.message);};this.persistQueue=this.persistQueue.then(save,save);return this.persistQueue;}
    async setNickname(value){this.profile.nickname=this.nickname(value);await this.persist();return this.profile.nickname;}
    id(){if(globalThis.crypto?.randomUUID)return globalThis.crypto.randomUUID();if(!globalThis.crypto?.getRandomValues)throw Error('This browser cannot create a private player identifier.');const b=globalThis.crypto.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const h=[...b].map(v=>v.toString(16).padStart(2,'0')).join('');return [h.slice(0,8),h.slice(8,12),h.slice(12,16),h.slice(16,20),h.slice(20)].join('-');}
    async json(url,options){const r=await this.request(url,{...options,signal:globalThis.AbortSignal?.timeout?.(12000)});const data=await r.json();if(!r.ok){const error=Error(data.error||data.msg||data.message||'Leaderboard request failed.');error.status=r.status;throw error;}return data;}
    auth(){if(!this.authPending)this.authPending=this.authenticate().finally(()=>{this.authPending=null;});return this.authPending;}
    async authenticate(){
      if(!this.enabled)throw Error('Online leaderboard is not connected. Your scores stay on this device.');
      if(!/^https:\/\//.test(this.config.url)&&!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(this.config.url))throw Error('Use an HTTPS backend.');
      const old=this.profile.auth;if(old?.access_token&&old.expires_at>Date.now()/1000+60)return old.access_token;
      const base=this.config.url.replace(/\/$/,'');let data;
      try{
        data=old?.refresh_token?await this.json(base+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:this.config.publicKey,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:old.refresh_token})}):await this.json(base+'/auth/v1/signup',{method:'POST',headers:{apikey:this.config.publicKey,'Content-Type':'application/json'},body:JSON.stringify({data:{}})});
      }catch(error){if(old&&(error.status===400||error.status===401)){this.profile.auth=null;await this.persist();throw Error('Anonymous session expired. Try again; old runs may require the original session.');}throw error;}
      if(!data.access_token||!data.user?.id)throw Error('Could not sign in anonymously.');
      this.profile.auth={access_token:data.access_token,refresh_token:data.refresh_token,expires_at:data.expires_at||Date.now()/1000+data.expires_in,userId:data.user.id};await this.persist();return data.access_token;
    }
    async api(action,data){
      const send=token=>this.json(this.config.url.replace(/\/$/,'')+'/functions/v1/leaderboard',{method:'POST',headers:{apikey:this.config.publicKey,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({action,data})});
      const token=await this.auth();try{return await send(token);}catch(error){if(error.status!==401)throw error;if(this.profile.auth)this.profile.auth.expires_at=0;await this.persist();return send(await this.auth());}
    }
    async begin(game){
      if(!this.profile.deviceId)this.profile.deviceId=this.id();
      const run={token:this.id(),deviceId:this.profile.deviceId,difficulty:game.difficulty,eligible:!game.creative&&!game.savedExtras.localOnly,registered:false,previousBest:game.highScores['survival:'+game.difficulty]||0};
      game.savedExtras.onlineRun=run;await this.persist();
      if(run.eligible&&this.enabled&&this.profile.nickname){try{await this.api('start',{token:run.token,nickname:this.profile.nickname,difficulty:run.difficulty,mode:'survival',rules:RULES,offline:false});run.registered=true;}catch{/* Keep the run for a later offline submission. */}}
    }
    invalidate(game,reason){game.savedExtras.localOnly=reason;if(game.savedExtras.onlineRun)game.savedExtras.onlineRun.eligible=false;}
    async finish(game){
      const run=game.savedExtras.onlineRun;
      if(game.creative||!run?.eligible||run.deviceId!==this.profile.deviceId||run.difficulty!==game.difficulty||game.phase!=='over')return {message:'Local result only: Creative, imported, or modified-difficulty runs do not enter online rankings.'};
      if(this.profile.submitted.includes(run.token))return {message:'Score already submitted. View Leaderboard for your current rank.'};
      if(!this.profile.pending.some(p=>p.token===run.token)){
        if(this.profile.pending.length>=100)throw Error('Your offline score queue is full. Submit existing scores first.');
        this.profile.pending.push({token:run.token,difficulty:run.difficulty,registered:run.registered,data:{token:run.token,highest_wave:Math.max(0,game.wave-1),zombies:game.kills,duration:game.elapsed,mode:'survival',rules:RULES}});
        await this.persist();
      }
      return this.flush();
    }
    async flush(){
      if(this.flushing)return this.flushing;
      const perform=async()=>{
        if(!this.profile.pending.length)return {message:'No queued scores.'};
        if(!this.profile.nickname)return {message:'Score kept locally. Choose a nickname in View Leaderboard to submit it.'};
        if(!this.enabled)return {message:'Online leaderboard is not connected. Scores are queued on this device.'};
        let latest;
        for(const score of [...this.profile.pending]){
          if(score.rejected)continue;
          try{
            if(!score.registered){await this.api('start',{token:score.token,nickname:this.profile.nickname,difficulty:score.difficulty,mode:'survival',rules:RULES,offline:true});score.registered=true;await this.persist();}
            latest=await this.api('submit',{...score.data,nickname:this.profile.nickname});
            this.profile.submitted=[...this.profile.submitted,score.token].slice(-1000);this.profile.pending=this.profile.pending.filter(p=>p.token!==score.token);await this.persist();
          }catch(error){
            if(error.status===400){score.rejected=error.message;await this.persist();return {message:'Score kept locally but rejected by validation: '+error.message};}
            return {message:'Score queued for retry. '+error.message};
          }
        }
        return latest?{...latest,message:'Your '+latest.difficulty+' ranking: #'+latest.rank+' · Personal best '+latest.best_score}: {message:'Queued results need review; no score was submitted.'};
      };
      this.flushing=perform().finally(()=>{this.flushing=null;});return this.flushing;
    }
    list(difficulty,offset=0){return this.api('list',{difficulty,offset});}
  }
  Z.Leaderboard=Leaderboard;Z.ONLINE_KEY=KEY;
})(window.ZCD);
