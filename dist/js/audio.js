/* All sound and music are original, synthesized locally. No audio assets or network. */
(function(Z){
  'use strict';
  class Audio {
    constructor(){this.ctx=null;this.sfx=true;this.music=true;this.unlocked=false;this.timer=null;this.step=0;this.nextNote=0;this.last={};}
    async unlock(){
      if(!this.ctx){
        const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return false;
        try{this.ctx=new AC();this.fxBus=this.ctx.createGain();this.musicBus=this.ctx.createGain();this.fxBus.gain.value=.24;this.musicBus.gain.value=.11;this.fxBus.connect(this.ctx.destination);this.musicBus.connect(this.ctx.destination);}catch{return false;}
      }
      try{await this.ctx.resume();this.unlocked=true;if(this.music)this.startMusic();return true;}catch{return false;}
    }
    tone(freq,duration=.12,type='square',volume=.25,delay=0,bus=this.fxBus,endFreq){
      if(!this.ctx||!this.unlocked)return;
      const t=this.ctx.currentTime+delay,osc=this.ctx.createOscillator(),gain=this.ctx.createGain();
      osc.type=type;osc.frequency.setValueAtTime(freq,t);
      if(endFreq)osc.frequency.exponentialRampToValueAtTime(endFreq,t+duration);
      gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(Math.max(.0002,volume),t+.008);
      gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
      osc.connect(gain);gain.connect(bus);osc.start(t);osc.stop(t+duration+.02);
      osc.onended=()=>{osc.disconnect();gain.disconnect();};
    }
    play(name){
      if(!this.sfx||!this.unlocked||this.ctx.state!=='running')return;
      const now=this.ctx.currentTime;
      if(now-(this.last[name]??-10)<({zombieHit:.1,wallHit:.13,archer:.07,coin:.1}[name]||.04))return;
      this.last[name]=now;
      const t=(f,d,w='square',v=.22,delay=0,end)=>this.tone(f,d,w,v,delay,this.fxBus,end);
      switch(name){
        case 'place':t(310,.07,'triangle',.5);t(620,.13,'square',.16,.055);break;
        case 'remove':t(390,.16,'triangle',.45,0,125);break;
        case 'archer':t(900,.09,'triangle',.35,0,220);break;
        case 'fire':t(125,.22,'sawtooth',.2,0,48);t(260,.1,'triangle',.3);break;
        case 'ice':t(1150,.23,'sine',.45,0,1600);t(1580,.13,'triangle',.2,.06);break;
        case 'zombieHit':t(160,.07,'triangle',.23,0,95);break;
        case 'defeat':t(240,.13,'square',.12,0,75);break;
        case 'castleHit':t(75,.24,'sawtooth',.3,0,40);break;
        case 'wallHit':t(95,.09,'square',.18,0,55);break;
        case 'coin':t(990,.1,'sine',.4);t(1320,.16,'sine',.3,.06);break;
        case 'wave':[293.66,369.99,440,587.33].forEach((f,i)=>t(f,.22,'square',.18,i*.12));break;
        case 'victory':[523.25,659.25,783.99,1046.5,783.99,1046.5].forEach((f,i)=>t(f,.26,'triangle',.5,i*.12));break;
        case 'gameover':[392,349.23,329.63,261.63].forEach((f,i)=>t(f,.38,'triangle',.4,i*.22));break;
      }
    }
    toggleSfx(){this.sfx=!this.sfx;return this.sfx;}
    toggleMusic(){this.music=!this.music;if(this.music&&this.unlocked)this.startMusic();else this.stopMusic();return this.music;}
    startMusic(){
      if(this.timer||!this.unlocked)return;
      this.musicBus.gain.setValueAtTime(.11,this.ctx.currentTime);this.nextNote=this.ctx.currentTime+.04;
      // "Frederik's Meadow": an original eight-bar tune in D major, at 110 BPM.
      const melody=[74,0,78,81,78,76,74,0, 69,74,76,78,76,74,73,0, 71,0,74,78,81,78,76,74, 73,76,81,0,78,76,73,69, 74,78,81,86,81,78,76,74, 71,74,78,81,79,78,76,0, 73,76,79,81,79,76,73,69, 74,0,78,76,74,0,69,0];
      const roots=[50,50,47,45,50,47,45,50], beat=60/110/2;
      const tick=()=>{
        if(this.ctx.state!=='running'){this.nextNote=this.ctx.currentTime+.04;return;}
        if(this.nextNote<this.ctx.currentTime-.1)this.nextNote=this.ctx.currentTime+.04;
        while(this.nextNote<this.ctx.currentTime+.22){
          const i=this.step%melody.length,delay=this.nextNote-this.ctx.currentTime;
          if(melody[i])this.tone(440*2**((melody[i]-69)/12),beat*.82,'triangle',.34,delay,this.musicBus);
          if(i%2===0){const n=roots[Math.floor(i/8)]+(i%4===2?7:0);this.tone(440*2**((n-69)/12),beat*1.6,'triangle',.27,delay,this.musicBus);}
          if(i%4===0)this.tone(440*2**((roots[Math.floor(i/8)]+19-69)/12),beat*.7,'sine',.12,delay,this.musicBus);
          this.step++;this.nextNote+=beat;
        }
      };tick();this.timer=setInterval(tick,90);
    }
    stopMusic(){if(this.timer)clearInterval(this.timer);this.timer=null;if(this.musicBus)this.musicBus.gain.setValueAtTime(0,this.ctx.currentTime);}
    async visibility(hidden){if(!this.ctx)return;if(hidden){this.stopMusic();await this.ctx.suspend();}else if(this.unlocked){await this.ctx.resume();if(this.music)this.startMusic();}}
  }
  Z.Audio=Audio;
})(window.ZCD);
