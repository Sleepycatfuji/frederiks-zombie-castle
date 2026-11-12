import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { App } from '@capacitor/app';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
window.NativeReady=(async()=>{
  if(!Capacitor.isNativePlatform())return;
  const store=await window.ZCD.NativeSaveStore.open(Preferences);
  const audioKey='zombie-castle-audio-v1';
  const settings=await Preferences.get({key:audioKey});
  window.ZCD.native={store,App,settingsStorage:await window.ZCD.NativeSettings.open(Preferences),audio:settings.value,
    async saveAudio(value){await Preferences.set({key:audioKey,value});if((await Preferences.get({key:audioKey})).value!==value)throw Error('Audio preferences failed');},
    async exportFile(data){const {uri}=await Filesystem.writeFile({path:'frederiks-castle-save.json',data,directory:Directory.Cache,encoding:Encoding.UTF8});await Share.share({title:"Frederik's Castle Defense save",url:uri});}
  };
})();
