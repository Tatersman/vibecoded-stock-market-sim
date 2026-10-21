import {build} from 'esbuild';
import {writeFile} from 'node:fs/promises';
const result=await build({entryPoints:['src/main.js'],bundle:true,write:false,outdir:'out',format:'iife',target:'es2022',minify:true});
const js=result.outputFiles.find(f=>f.path.endsWith('.js')).text;
const css=result.outputFiles.find(f=>f.path.endsWith('.css')).text;
const html=`<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Market Lab · Daily Top Five</title><style>${css}</style></head><body><div id="app"></div><script>${js.replaceAll('</script','<\\/script')}</script></body></html>`;
await writeFile('index.html',html);
await writeFile('market-lab.html',html);
console.log('Built standalone index.html (main entry) and market-lab.html (compatibility copy)');
