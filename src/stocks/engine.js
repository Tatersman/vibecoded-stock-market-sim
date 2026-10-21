// Causal, long-only stock rotation. Nothing in a signal uses the execution bar.
const SYMBOL=/^[A-Z][A-Z0-9.-]{0,14}$/;
const EPSILON=1e-9;
const defaults={capital:100000,feeBps:10,slippageBps:5,lookback:21,maxQuoteAgeMs:120000};
const average=values=>values.reduce((sum,value)=>sum+value,0)/values.length;
function settings(input={}) {
 const config={...defaults,...input};
 if(!Number.isFinite(config.capital)||config.capital<=0)throw Error('Starting capital must be positive.');
 for(const key of ['feeBps','slippageBps'])if(!Number.isFinite(config[key])||config[key]<0||config[key]>1000)throw Error('Fees and slippage must be between 0 and 1,000 bps.');
 if(!Number.isInteger(config.lookback)||config.lookback<5||config.lookback>252)throw Error('Lookback must be a whole number from 5 to 252.');
 return config;
}
function realDate(value){return /^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;}
export function validateUniverse(input) {
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('A stock universe must map symbols to daily price bars.');
 const entries=Object.entries(input);
 if(entries.length<5||entries.length>100)throw Error('Provide between 5 and 100 stock histories.');
 const normalized={};
 for(const [symbol,bars] of entries){
  if(!SYMBOL.test(symbol))throw Error('Invalid stock symbol.');
  if(!Array.isArray(bars)||bars.length<2)throw Error(`${symbol} needs at least two daily bars.`);
  let previous='';
  normalized[symbol]=bars.map(bar=>{
   const time=String(bar.time??bar.date??'');
   if(!realDate(time)||time<=previous)throw Error(`${symbol} dates must be real, unique, and ascending.`);
   previous=time;
   const row={time,open:Number(bar.open),close:Number(bar.close)};
   for(const key of ['high','low'])if(bar[key]!==undefined)row[key]=Number(bar[key]);
   if(!['open','close','high','low'].filter(key=>row[key]!==undefined).every(key=>Number.isFinite(row[key])&&row[key]>0)||(row.high!==undefined&&row.high<Math.max(row.open,row.close,row.low??0))||(row.low!==undefined&&row.low>Math.min(row.open,row.close,row.high??Infinity)))throw Error(`${symbol} has inconsistent OHLC prices.`);
   if(bar.volume!==undefined){row.volume=Number(bar.volume);if(!Number.isFinite(row.volume)||row.volume<0)throw Error(`${symbol} volume must be nonnegative.`);}
   return row;
  });
 }
 return normalized;
}
export function commonDates(universe) {
 const histories=Object.values(universe);
 if(!histories.length)return [];
 const sets=histories.slice(1).map(bars=>new Set(bars.map(bar=>bar.time)));
 return histories[0].map(bar=>bar.time).filter(time=>sets.every(set=>set.has(time)));
}
export function rankStocks(historyBySymbol,{lookback=21}={}) {
 if(!Number.isInteger(lookback)||lookback<5)throw Error('Lookback must be at least five sessions.');
 const entries=Object.entries(historyBySymbol),latest=new Set(entries.map(([,bars])=>bars.at(-1)?.time));
 if(latest.size!==1)throw Error('Ranking requires histories ending on the same completed trading date.');
 const reference=entries[0]?.[1].slice(-lookback-1).map(bar=>bar.time).join(',');
 if(entries.some(([,bars])=>bars.slice(-lookback-1).map(bar=>bar.time).join(',')!==reference))throw Error('Ranking requires aligned completed trading dates for every stock.');
 return entries.map(([symbol,bars])=>{
  if(bars.length<lookback+1)throw Error(`${symbol} needs ${lookback+1} completed bars to rank.`);
  const closes=bars.slice(-lookback-1).map(bar=>bar.close);
  if(!closes.every(value=>Number.isFinite(value)&&value>0))throw Error('Ranking prices must be positive.');
  const returns=closes.slice(1).map((value,index)=>value/closes[index]-1),mean=average(returns);
  const volatility=Math.sqrt(average(returns.map(value=>(value-mean)**2)));
  const momentum=closes.at(-1)/closes[0]-1;
  return {symbol,score:momentum-.5*volatility*Math.sqrt(lookback),momentum,volatility,asOf:bars.at(-1).time};
 }).sort((a,b)=>b.score-a.score||a.symbol.localeCompare(b.symbol));
}
export function createPortfolio(capital=100000) {
 if(!Number.isFinite(capital)||capital<=0)throw Error('Starting capital must be positive.');
 return {cash:capital,holdings:{},initial:capital,value:capital,peak:capital,drawdown:0,fees:0,turnover:0,trades:[],curve:[]};
}
function quotePrice(value,symbol,time,maxAge=120000) {
 const price=typeof value==='object'&&value!==null?value.price:value;
 if(!Number.isFinite(price)||price<=0)throw Error(`Missing or invalid execution price for ${symbol}; no orders were filled.`);
 if(typeof value==='object'&&value!==null){
  const quoted=Date.parse(value.time??value.timestamp),execution=Date.parse(time);
  if(!Number.isFinite(quoted)||!Number.isFinite(execution))throw Error(`${symbol} quote needs a valid timestamp.`);
  if(String(value.time??value.timestamp).slice(0,10)!==String(time).slice(0,10)||quoted>execution+1000||(!realDate(String(time))&&execution-quoted>maxAge))throw Error(`${symbol} quote is stale or from a different session; no orders were filled.`);
 }
 return price;
}
function totalValue(portfolio,prices){return portfolio.cash+Object.entries(portfolio.holdings).reduce((sum,[symbol,qty])=>sum+qty*prices[symbol],0);}
export function rebalance(portfolio,picks,pricesBySymbol,time,input={}) {
 const config=settings({...input,capital:portfolio.initial});
 const symbols=picks.map(pick=>typeof pick==='string'?pick:pick.symbol);
 const limit=input.maxHoldings??input.maxPositions??5;
 if(symbols.length>limit||new Set(symbols).size!==symbols.length||symbols.some(symbol=>!SYMBOL.test(symbol)))throw Error(`Select at most ${limit} distinct valid symbols.`);
 // Validate the complete transaction before changing any cash or position.
 const required=[...new Set([...symbols,...Object.keys(portfolio.holdings)])];
 const prices=Object.fromEntries(required.map(symbol=>[symbol,quotePrice(pricesBySymbol[symbol],symbol,time,config.maxQuoteAgeMs)]));
 const equity=totalValue(portfolio,prices),target=symbols.length?equity*.95/symbols.length:0;
 const targets=Object.fromEntries(symbols.map(symbol=>[symbol,target/prices[symbol]]));
 const feeRate=config.feeBps/10000,slip=config.slippageBps/10000;
 const fill=(symbol,side,qty)=>{
  const price=prices[symbol]*(side==='BUY'?1+slip:1-slip),notional=qty*price,fee=notional*feeRate;
  portfolio.cash+=side==='BUY'?-(notional+fee):notional-fee;
  portfolio.holdings[symbol]=(portfolio.holdings[symbol]??0)+(side==='BUY'?qty:-qty);
  if(portfolio.holdings[symbol]<EPSILON)delete portfolio.holdings[symbol];
  portfolio.fees+=fee;portfolio.turnover+=notional;
  portfolio.trades.push({time,symbol,side,qty,price,fee,notional,reason:input.reason??'Daily target-weight rebalance'});
 };
 // Sell dropped/reduced positions first, then fund purchases pro rata.
 for(const [symbol,qty] of Object.entries(portfolio.holdings)){
  const reduction=qty-(targets[symbol]??0);
  if(reduction>EPSILON)fill(symbol,'SELL',reduction);
 }
 const buys=symbols.map(symbol=>({symbol,qty:Math.max(0,targets[symbol]-(portfolio.holdings[symbol]??0))})).filter(row=>row.qty>EPSILON);
 const requiredCash=buys.reduce((sum,row)=>sum+row.qty*prices[row.symbol]*(1+slip)*(1+feeRate),0);
 const factor=requiredCash>0?Math.min(1,Math.max(0,portfolio.cash)/requiredCash):0;
 for(const row of buys)if(row.qty*factor>EPSILON)fill(row.symbol,'BUY',row.qty*factor);
 if(portfolio.cash<0&&portfolio.cash>-1e-6)portfolio.cash=0;
 portfolio.value=totalValue(portfolio,prices);
 return portfolio;
}
export function markPortfolio(portfolio,pricesBySymbol,time) {
 const prices=Object.fromEntries(Object.keys(portfolio.holdings).map(symbol=>[symbol,quotePrice(pricesBySymbol[symbol],symbol,time)]));
 const value=totalValue(portfolio,prices);
 portfolio.value=value;portfolio.peak=Math.max(portfolio.peak,value);portfolio.drawdown=Math.max(portfolio.drawdown,(portfolio.peak-value)/portfolio.peak);
 const point={time,value};
 if(portfolio.curve.at(-1)?.time===time)portfolio.curve[portfolio.curve.length-1]=point;else portfolio.curve.push(point);
 return value;
}
export function runBacktest(input,options={}) {
 const config=settings(options),universe=validateUniverse(input),symbols=Object.keys(universe).sort(),dates=commonDates(universe);
 if(dates.length<config.lookback+2)throw Error(`Need at least ${config.lookback+2} common sessions, including ${config.lookback+1} warm-up bars.`);
 const from=options.from??dates[config.lookback+1],to=options.to??dates.at(-1);
 if(!realDate(from)||!realDate(to)||from>to)throw Error('Choose a valid backtest date range.');
 const aligned=Object.fromEntries(symbols.map(symbol=>{const byDate=new Map(universe[symbol].map(bar=>[bar.time,bar]));return [symbol,dates.map(date=>byDate.get(date))]}));
 const rotation=createPortfolio(config.capital),benchmark=createPortfolio(config.capital),snapshots=[],days=[];
 for(let index=config.lookback+1;index<dates.length;index++){
  const time=dates[index];if(time<from||time>to)continue;
  const history=Object.fromEntries(symbols.map(symbol=>[symbol,aligned[symbol].slice(index-config.lookback-1,index)]));
  const ranking=rankStocks(history,config),picks=ranking.slice(0,5);
  const open=Object.fromEntries(symbols.map(symbol=>[symbol,aligned[symbol][index].open])),close=Object.fromEntries(symbols.map(symbol=>[symbol,aligned[symbol][index].close]));
  rebalance(rotation,picks,open,time,config);
  if(!days.length)rebalance(benchmark,symbols,open,time,{...config,maxHoldings:symbols.length,reason:'Equal-weight universe buy and hold'});
  markPortfolio(rotation,close,time);markPortfolio(benchmark,close,time);
  days.push(time);snapshots.push({time,signalDate:dates[index-1],ranking,picks:picks.map(row=>row.symbol),holdings:{...rotation.holdings},cash:rotation.cash,value:rotation.value,benchmarkValue:benchmark.value});
 }
 if(!days.length)throw Error('No eligible sessions in this range after warm-up.');
 return {rotation,benchmark,days,snapshots,universe:symbols,from:days[0],to:days.at(-1),config};
}
