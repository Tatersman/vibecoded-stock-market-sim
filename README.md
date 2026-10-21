# Market Lab

Automated paper trading and historical strategy races. No real orders, accounts, or API keys.

## Open immediately

Download the repository ZIP, extract it, and open **market-lab.html** in Chrome, Firefox, or Edge. Historical replay includes real Apple daily OHLC from February 17, 2015 through February 16, 2017 and works offline. Live crypto requires an Internet connection and provider access. The standalone file is generated from the same source as the development app.

## Strategy Lab

- **Drift:** custom 10/30 simple moving-average trend plus 5-bar momentum entry; exit on trend reversal or a 5-bar loss beyond 2%.
- **Snapback:** 14-bar simple RSI mean reversion, entry below 30, exit above 60.
- **Rangebreak:** enter above the previous 20 closing prices, exit below the previous 10.
- **Buy & hold:** reference portfolio on the same execution timeline.

These are custom implementations of conventional disclosed rules, not claims of institutional secrets or proven alpha.

### Historical mode

Choose dates, starting capital, fee and slippage assumptions. Play at 1, 10, or 50 days per second, step one bar, or finish instantly. Compare portfolio value, dollar P&L, returns, maximum drawdown, fills, fees, and percentage-point difference against the benchmark. Export the complete trade tape as CSV.

Each strategy starts with its own cash balance. Thirty-one prior bars warm up signals. Decisions use completed bars and execute at the next bar's open, with adverse slippage and fees. Entries use 95% of cash and fractional units; exits liquidate the position. No shorting or leverage. Final positions are marked at the last close, not forcibly liquidated. Returns exclude dividends, taxes, interest, and market impact. Historical winners and repeatedly chosen date ranges do not establish future performance.

Import stock or crypto OHLC with this CSV format (32–10,000 ascending unique daily bars, at most 2 MB):

```csv
date,open,high,low,close
2025-01-02,100,103,99,102
2025-01-03,102,105,101,104
```

The example shows only the format; provide at least 32 rows. Use consistently split-adjusted OHLC for series spanning stock splits. Imported files stay in your browser's memory. Imports are validated for dates and price consistency but not independently verified.

### Live paper trading

Choose BTC-USD, ETH-USD, or SOL-USD, then **Connect live feed**. Public Coinbase completed one-minute candles warm up the same algorithms. Coinbase WebSocket ticker events build the current minute. Signals based only on closed bars fill at the first observed tick of the next minute. The chart and holdings mark to incoming ticks. The benchmark waits until the same eligible execution boundary. If candle warm-up fails, the feed must collect 31 closed minutes before any strategy trades.

Stale messages do not execute. Gaps suspend trading and trigger a new warm-up. Disconnections are explicit; there is no fake feed fallback or invented trading while offline. Keep the Strategy Lab and browser tab open; this is not a background/server trading bot. Sessions are in memory and reset on reload, mode change, or a new paper session. Export results before leaving. Manual paper trading remains separate and persists in localStorage.

Provider access requires:

- `https://api.exchange.coinbase.com` (public candles, browser CORS required)
- `wss://ws-feed.exchange.coinbase.com` (public ticker subscription)

The cloud environment's proxy returned HTTP 403 for Coinbase and blocked the actual browser feed during validation. Feed logic is tested with fixtures; a successful external live session has **not** been verified here. No credentials should be entered to fix this public-feed network restriction.

## Development

Use Node.js 22.12+ or 24 (validated on 24.19.0).

```sh
npm ci
npm run dev
```

If the default npm cache is unavailable, use `npm ci --cache /workspace/.npm-cache`.

```sh
npm test
npm run build
npm run build:standalone
npm run preview
```

Run `build:standalone` after source changes before committing `market-lab.html`. The tests exercise costs, signal rules, causal execution, drawdown, imported data validation, replay determinism, UI controls, and live feed behavior with controlled fixtures. Desktop/mobile Chromium checks were also run during development.

## Historical source

The bundled 506-bar AAPL sample is derived from Plotly's public `finance-charts-apple.csv`, using `Date` and unadjusted `AAPL.Open/High/Low/Close` fields:
https://github.com/plotly/datasets/blob/master/finance-charts-apple.csv

Retrieved October 21, 2026. The sample is an old, selected illustration, not a current market feed. The original manual trading screen retains illustrative fixed prices and illustrative charts.
