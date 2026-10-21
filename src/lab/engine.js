export const strategies = [
  {id:'drift',name:'Drift',color:'#b8ed80',description:'Trend + momentum · enter when SMA(10) > SMA(30) and 5-bar return is positive; exit on a trend reversal or 5-bar loss beyond 2%.'},
  {id:'snap',name:'Snapback',color:'#81b9ff',description:'Mean reversion · enter below RSI(14) 30; exit above RSI 60. Hold between thresholds.'},
  {id:'break',name:'Rangebreak',color:'#d6acf9',description:'Breakout · enter above the preceding 20 closes; exit below the preceding 10 closes.'},
  {id:'hold',name:'Buy & hold',color:'#f4c97b',description:'Benchmark · buy on the first eligible bar and hold. Same allocation and execution costs.'}
];
const avg=a=>a.reduce((s,x)=>s+x,0)/a.length;
export function signal(id,bars,held){
 if(bars.length<31)return false;
 const closes=bars.map(b=>b.close),last=closes.at(-1);
 if(id==='hold')return true;
 if(id==='drift'){const trend=avg(closes.slice(-10))>avg(closes.slice(-30)),momentum=last/closes.at(-6)-1;return trend&&(held?momentum>=-.02:momentum>0);}
 if(id==='snap'){const changes=closes.slice(-15).slice(1).map((v,i)=>v-closes.slice(-15)[i]);const gain=avg(changes.map(v=>Math.max(0,v))),loss=avg(changes.map(v=>Math.max(0,-v)));const rsi=gain===0&&loss===0?50:loss===0?100:100-100/(1+gain/loss);return held?rsi<=60:rsi<30;}
 if(id==='break')return held?last>=Math.min(...closes.slice(-11,-1)):last>Math.max(...closes.slice(-21,-1));
 throw Error('Unknown strategy');
}
export function createAccounts(capital){return strategies.map(s=>({...s,cash:capital,qty:0,initial:capital,peak:capital,drawdown:0,fees:0,trades:[],curve:[]}));}
export function execute(account,want,price,time,config){
 const fee=config.feeBps/10000,slip=config.slippageBps/10000;
 if(want&&account.qty===0){const fill=price*(1+slip),budget=account.cash*.95,qty=budget/(fill*(1+fee)),cost=qty*fill,charge=cost*fee;account.cash-=cost+charge;account.qty=qty;account.fees+=charge;account.trades.push({time,side:'BUY',qty,price:fill,fee:charge,reason:account.description});}
 else if(!want&&account.qty>0){const fill=price*(1-slip),proceeds=account.qty*fill,charge=proceeds*fee;account.cash+=proceeds-charge;account.fees+=charge;account.trades.push({time,side:'SELL',qty:account.qty,price:fill,fee:charge,reason:account.description});account.qty=0;}
}
export function mark(account,price,time){const value=account.cash+account.qty*price;account.peak=Math.max(account.peak,value);account.drawdown=Math.max(account.drawdown,(account.peak-value)/account.peak);account.value=value;account.curve.push({time,value});return value;}
export function step(accounts,history,bar,config){for(const account of accounts){execute(account,signal(account.id,history,account.qty>0),bar.open,bar.time,config);mark(account,bar.close,bar.time);}}
export function validateBars(input){
 if(!Array.isArray(input)||input.length<32)throw Error('At least 32 price bars are required (31 for warm-up).');
 let previous='';return input.map(b=>{const time=String(b.time);if(!/^\d{4}-\d{2}-\d{2}$/.test(time)||!Number.isFinite(Date.parse(time))||new Date(time).toISOString().slice(0,10)!==time)throw Error('Dates must be real calendar dates in YYYY-MM-DD format.');if(time<=previous)throw Error('Dates must be unique and ascending.');previous=time;const row={time,...Object.fromEntries(['open','high','low','close'].map(k=>[k,Number(b[k])]))};if(!Object.values(row).slice(1).every(n=>Number.isFinite(n)&&n>0)||row.high<Math.max(row.open,row.close,row.low)||row.low>Math.min(row.open,row.close))throw Error('Prices must be positive, with high/low enclosing open and close.');return row;});
}
export function parseCSV(text){const lines=text.replace(/^\uFEFF/,'').trim().split(/\r?\n/),headers=lines.shift().split(',').map(x=>x.trim().toLowerCase().replaceAll('"',''));const keys=['date','open','high','low','close'];if(!keys.every(k=>headers.includes(k)))throw Error('CSV needs date,open,high,low,close headers.');return validateBars(lines.filter(x=>x.trim()).map(line=>{const cols=line.split(',').map(x=>x.trim().replaceAll('"',''));return Object.fromEntries(keys.map(k=>[k==='date'?'time':k,cols[headers.indexOf(k)]]));}));}
