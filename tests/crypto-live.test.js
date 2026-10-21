import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {buildSync} from 'esbuild';
const bundle=buildSync({entryPoints:['src/main.js'],bundle:true,write:false,outdir:'out',format:'iife'}).outputFiles.find(f=>f.path.endsWith('.js')).text;
function fixture(saved){
 const dom=new JSDOM('<div id="app"></div>',{url:'https://market-lab.example',runScripts:'outside-only'}),w=dom.window;
 if(saved)w.localStorage.setItem('marketlab-crypto-v2',saved);
 let now=Date.parse('2026-10-21T15:00:10Z');const RealDate=w.Date;w.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[now]))}static now(){return now}};
 const sockets=[];w.WebSocket=class{constructor(){sockets.push(this);this.readyState=0}send(data){this.subscription=JSON.parse(data)}close(){this.readyState=3;this.onclose?.()}};
 w.fetch=async()=>({ok:true,json:async()=>{const minute=Math.floor(now/60000)*60000;return Array.from({length:41},(_,i)=>[(minute-(40-i)*60000)/1000,99+i,101+i,100+i,100+i,1000]).reverse()}});
 w.eval(bundle);w.document.querySelector('[data-view="Strategy Lab"]').click();
 const click=s=>{const el=w.document.querySelector(s);assert.ok(el,`Missing ${s}`);el.click()};
 const enter=()=>click('[data-mode="live"]');
 const connect=async()=>{click('#connect');await new Promise(r=>setImmediate(r));const socket=sockets.at(-1);socket.readyState=1;socket.onopen();return socket};
 const tick=(socket,price,time=now)=>socket.onmessage({data:JSON.stringify({type:'ticker',product_id:'BTC-USD',price:String(price),time:new RealDate(time).toISOString()})});
 return {dom,w,sockets,click,enter,connect,tick,advance:n=>{now+=n},storage:()=>w.localStorage.getItem('marketlab-crypto-v2')};
}
test('live strategies keep trading across app navigation and restore persisted portfolios paused',async()=>{
 const f=fixture();let saved;
 try{f.enter();const socket=await f.connect();f.tick(socket,141);f.advance(60000);f.tick(socket,142);const first=JSON.parse(f.storage())['BTC-USD'];assert.equal(first.liveCount,1);assert.ok(first.accounts.some(a=>a.qty>0));f.click('[data-view="Overview"]');assert.equal(socket.readyState,1);f.advance(60000);f.tick(socket,143);f.click('[data-view="Strategy Lab"]');assert.match(f.w.document.querySelector('#strategy-lab').textContent,/2 execution bars/);assert.equal(socket.readyState,1);f.click('#connect');saved=f.storage();assert.ok(saved)}finally{f.dom.window.close()}
 const restored=fixture(saved);try{restored.enter();assert.match(restored.w.document.querySelector('#strategy-lab').textContent,/Saved session · paused/);assert.equal(restored.sockets.length,0);const values=JSON.parse(restored.storage())['BTC-USD'];assert.equal(values.liveCount,2);assert.ok(values.accounts.some(a=>a.qty>0));assert.equal(restored.w.document.querySelector('#connect').textContent,'Connect live feed')}finally{restored.dom.window.close()}
});
test('disconnection retries and stale or duplicate ticks never execute extra bars',async()=>{
 const f=fixture();try{f.enter();const socket=await f.connect();f.tick(socket,141);f.advance(60000);f.tick(socket,142);const before=JSON.parse(f.storage())['BTC-USD'].liveCount;f.tick(socket,143);f.tick(socket,144,Date.parse('2026-10-21T14:58:00Z'));assert.equal(JSON.parse(f.storage())['BTC-USD'].liveCount,before);socket.onclose();assert.match(f.w.document.querySelector('#strategy-lab').textContent,/retrying in 1s/);await new Promise(r=>setTimeout(r,1100));assert.equal(f.sockets.length,2);const second=f.sockets[1];second.readyState=1;second.onopen();f.tick(second,145);assert.equal(JSON.parse(f.storage())['BTC-USD'].liveCount,before);f.click('#connect');assert.match(f.w.document.querySelector('#strategy-lab').textContent,/Disconnected/)}finally{f.dom.window.close()}
});
test('malformed stored sessions are ignored instead of breaking live UI',()=>{const f=fixture(JSON.stringify({'BTC-USD':{version:2,accounts:[]}}));try{f.enter();assert.match(f.w.document.querySelector('#strategy-lab').textContent,/No fills yet/);assert.equal(f.w.document.querySelector('#connect').textContent,'Connect live feed')}finally{f.dom.window.close()}});
