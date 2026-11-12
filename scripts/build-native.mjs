import {build} from 'esbuild';
import {cp,readFile,writeFile,mkdir} from 'node:fs/promises';
await mkdir('native-dist',{recursive:true});
await cp('dist','native-dist',{recursive:true,filter:source=>!source.endsWith('.zip')});
await build({entryPoints:['native/bridge.js'],bundle:true,format:'iife',outfile:'native-dist/js/native-bridge.js',minify:true});
const html=await readFile('native-dist/index.html','utf8');
await writeFile('native-dist/index.html',html.replace('<script defer src="./js/app.js">','<script defer src="./js/native-bridge.js"></script>\n  <script defer src="./js/app.js">'));
console.log('Built local Capacitor assets in native-dist/.');
