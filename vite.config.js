import {defineConfig,loadEnv} from 'vite';
import {createMarketProvider,createStockService,createStockMiddleware} from './server/stocks.js';
export default defineConfig(({mode})=>{
 const local=loadEnv(mode,process.cwd(),'');
 const service=createStockService({provider:createMarketProvider({env:{...local,...process.env}})});
 return {server:{host:'0.0.0.0'},preview:{host:'0.0.0.0'},build:{rollupOptions:{input:'app.html'}},plugins:[{
  name:'market-lab-stock-api',enforce:'post',
  configureServer(server){server.middlewares.use(createStockMiddleware(service));server.middlewares.use((req,res,next)=>{const url=new URL(req.url,'http://localhost');if(url.pathname==='/'||url.pathname==='/index.html')req.url='/app.html'+url.search;next()});server.httpServer?.on('close',()=>void service.dispose());},
  configurePreviewServer(server){server.middlewares.use(createStockMiddleware(service));server.httpServer?.on('close',()=>void service.dispose());},
  generateBundle:{order:'post',handler(options,bundle){if(bundle['app.html']){const page=bundle['app.html'];delete bundle['app.html'];page.fileName='index.html';bundle['index.html']=page;}}}
 }]};
});
