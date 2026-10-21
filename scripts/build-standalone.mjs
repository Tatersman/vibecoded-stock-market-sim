import {build} from 'esbuild';
import {writeFile} from 'node:fs/promises';
const result=await build({entryPoints:['src/main.js'],bundle:true,write:false,outdir:'out',format:'iife',target:'es2022',minify:true});
const js=result.outputFiles.find(f=>f.path.endsWith('.js')).text;
const css=result.outputFiles.find(f=>f.path.endsWith('.css')).text;
await writeFile('market-lab.html',`<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Market Lab · Strategy Lab</title><style>${css}</style></head><body><div id="app"></div><script>${js.replaceAll('</script','<\\/script')}</script></body></html>`);
console.log('Built standalone market-lab.html');
