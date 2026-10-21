# Market Lab

Paper trading, daily top-five stock rotation, and fast historical strategy races.

## Open the app

Download the GitHub ZIP, extract it, and open **index.html** in Chrome, Firefox, or Edge. This is the main entry and includes the app, styles, and bundled historical data. No installation is needed for historical replay. `market-lab.html` is an identical compatibility copy.

The default **Top Five** screen contains a recent stock simulation. Click **Run recent backtest** for immediate results or **Watch daily picks** to see the portfolio change over time. Change dates, starting cash, fees, and slippage; export all fills as CSV.

## Daily Top Five algorithm

Each trading day, score a fixed 20-stock universe using 22 completed price bars:

`score = 21-session close-to-close return − 0.5 × daily-return standard deviation × sqrt(21)`

Select the five highest scores, including during falling markets. “Best” means highest under this rule, not a prediction of guaranteed winners. Equal-weight the five within 95% of equity; leave a cash reserve. Sell reductions before buying additions, using fractional shares. Fees and adverse slippage apply on every fill. There is no leverage or shorting.

Rankings never use the execution day's close. Historical orders execute at the following session's recorded first trade plus costs. The comparison portfolio buys the entire same universe once at equal weights, with the same allocation, cash, and costs. Results include unrealized gains and maximum drawdown; positions are not forcibly liquidated at the end.

### Recent historical data

The bundled 20-stock universe has 201 aligned sessions, **January 2–October 20, 2026**. The default backtest runs February 4–October 20 after its 22-session warm-up.

Universe: AAPL, NVDA, AMZN, TSLA, AMD, NFLX, JPM, XOM, WMT, JNJ, DIS, KO, CVX, INTC, IBM, AXP, COIN, LLY, UBER, GE.

Source: IEX historical exchange data mirrored by [Roy-jpeg/to-the-moon-data](https://github.com/Roy-jpeg/to-the-moon-data/tree/96cacc4ee0271370781e28e8a77b753853339e3c/data/days), frozen at commit `96cacc4ee0271370781e28e8a77b753853339e3c`. Retrieved October 21, 2026. The data contains **first/last regular-session round-lot trades on IEX**, not consolidated official exchange opens/closes. No high/low fields are invented.

Data provided for free by IEX. By accessing or using IEX Historical Data, you agree to the [IEX Historical Data Terms of Use](https://www.iex.io/legal/hist-data-terms).

The mirror has not been independently reconciled against a consolidated feed. Prices are unadjusted for corporate actions and dividends. The January start avoids the known November 2025 NFLX split. The fixed chosen universe introduces selection and survivorship bias. Costs do not model taxes, liquidity, or market impact. No cash dividends or interest are credited. Returns are hypothetical and selecting winning date windows introduces hindsight bias.

**Fetch latest data** uses the local stock service: Alpaca IEX adjusted bars when configured, otherwise the unofficial Yahoo chart endpoint. Provider/network failures are explicit and do not substitute fake prices. Updated provider-adjusted datasets may include dividend/split adjustments and therefore differ from the unadjusted bundled sample.

## Live US stock paper trading

This needs the local server and an Alpaca market-data API key/secret. Historical simulation does not need keys.

1. Install Node.js 22.12+ or 24.
2. Run `npm ci` in the project directory.
3. Copy `.env.example` to `.env.local` and enter your own `ALPACA_API_KEY` and `ALPACA_SECRET_KEY` there. Do not use a `VITE_` prefix and never commit or share this file.
4. Run `npm run dev` and open the printed address.
5. In Top Five, choose **Live stock trading**, check the connection, and start paper trading.

Keys remain server-side. The service **never sends brokerage orders**. It polls real-time Alpaca IEX trades every 15 seconds, ranks completed daily bars, and rebalances once per actual open US market date. Starting late executes at fresh current prices, not a fictional market open. The market clock/calendar respects closed sessions; stale/missing prices or missing prior-session history block the entire rebalance. Rotation and benchmark changes commit together to avoid partial updates.

The stock service runs while the local server remains on, even when the browser closes. State persists under ignored `.local/stock-session.json`; server restarts restore it paused. Stop and create a new account to change its parameters. The server must reach `data.alpaca.markets` and `paper-api.alpaca.markets`.

No Alpaca credentials were present during development. End-to-end external stock trading remains unverified; the credential checks, scheduling, price validation, persistence, and executions were tested with controlled provider fixtures.

## Strategy Lab

The other three algorithms run alongside a buy-and-hold benchmark:

- **Drift:** 10/30 SMA trend plus 5-bar momentum; exit on reversal or a 5-bar loss beyond 2%.
- **Snapback:** simple RSI(14) mean reversion; enter below 30, exit above 60.
- **Rangebreak:** enter above the prior 20 closes; exit below the prior 10.

Historical mode includes a separate old AAPL daily sample (2015–2017, [Plotly source](https://github.com/plotly/datasets/blob/master/finance-charts-apple.csv)) and accepts stock/crypto CSV imports. CSV format is `date,open,high,low,close`, with 32–10,000 ascending unique daily rows, up to 2 MB. First 31 bars warm signals, then trades execute at the next bar's open. Use consistently adjusted OHLC if importing periods containing splits.

### Live crypto

Select BTC-USD, ETH-USD, or SOL-USD and connect. A public Coinbase WebSocket stream builds one-minute candles and marks all four paper portfolios. Completed prior bars decide signals; orders fill on the next observed minute's first tick. Completed recent candles warm up the strategies; if unavailable, the stream must collect 31 closed minutes first.

All four continue while navigating other screens. Keep the browser tab open. Automatic reconnect backs off from 1 to 30 seconds. Stale, duplicate, out-of-order, and gapped data do not create invented trades. Sessions save per product in localStorage and restore paused after reload. Explicit disconnect or selecting historical mode stops execution.

Required destinations: `api.exchange.coinbase.com` and `ws-feed.exchange.coinbase.com`. This cloud proxy blocked the actual Coinbase feed during development, so successful external live streaming is not claimed. Connection failures remain visible.

Manual trades on Overview remain separate, use fixed illustrative prices, and persist in browser localStorage.

## Development

```sh
npm ci
npm run dev
npm test
npm run build
npm run build:standalone
npm run preview
```

If the default npm cache is unavailable, use `npm ci --cache /workspace/.npm-cache`.

Edit `src/`; `app.html` is the development template. Vite serves it for `/` in development and builds the production entry as `dist/index.html`. `build:standalone` bundles the source into root `index.html` and its compatibility copy. Regenerate those after changing source before committing.

Tests cover signals, causal daily ranking, costs and accounting, five-position rotation, stale quotes, market scheduling, atomic execution, persistence, UI settings, crypto reconnects, and replay behavior. Desktop/mobile Chromium checks also exercise actual rendering, exports, and standalone historical use.
