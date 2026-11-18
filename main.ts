import { runBars } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';

// BTC Dip Rider v5 — dip-buy / mean-reversion, long-only.
// Entry: close >= 1.2% below the rolling 120-bar (2h) high. No momentum
// filter: in a slow bleed the bounce, not the trend, is the edge.
// Exit: TP +0.8% vs entry, trailing stop 1.2% vs peak, SL -1.2% vs entry,
// max hold 240 bars, 30-bar cooldown after an exit, 240-close warmup.
// Chosen on a flat plateau, not a peak: dip 1.1-1.2% and TP 0.6-1.0% are
// all profitable on BOTH dev windows (new 18 Nov + old 17 Nov).
const DIP_PM = 12; // entry dip below 120-bar high, per mille
const LOOKBACK = 120; // bars for the rolling high
const TP_PM = 8; // take profit vs entry, per mille
const TRAIL_PM = 12; // trailing stop vs peak, per mille
const SL_PM = 12; // stop loss vs entry, per mille
const MAX_HOLD = 240; // max bars held
const COOLDOWN = 30; // bars to wait after an exit before re-entering
const WARMUP = 240; // closes needed before first entry

const closes: bigint[] = [];
let pending: 'buy' | 'sell' | null = null;
let wasLong = false;
let peak = 0n;
let entryClose = 0n;
let entryBar = -1;
let lastExitBar = -1_000_000;

await runBars({
  onBatch(state, batch) {
    const position = state.positions.get(SYMBOL);
    const isLong = position !== undefined;
    if (wasLong && !isLong) lastExitBar = batch.seq;

    const bar = batch.bars.find((candidate) => candidate.symbol === SYMBOL);
    if (bar === undefined) {
      wasLong = isLong;
      return [];
    }

    const close = BigInt(bar.c);
    closes.push(close);

    if (pending !== null) pending = null;

    if (isLong && !wasLong) {
      entryClose = close;
      entryBar = batch.seq;
      peak = close;
    }
    if (isLong && close > peak) peak = close;

    if (!state.warmingUp && batch.seq < 1439) {
      if (isLong) {
        const shouldExit = close * 1000n <= peak * (1000n - BigInt(TRAIL_PM))
          || close * 1000n <= entryClose * (1000n - BigInt(SL_PM))
          || close * 1000n >= entryClose * (1000n + BigInt(TP_PM))
          || batch.seq - entryBar >= MAX_HOLD;
        if (shouldExit && pending === null) {
          pending = 'sell';
          wasLong = true;
          return [{ side: 'sell', symbol: SYMBOL, qty: position.qty, max_slippage_bps: 150 }];
        }
      } else if (pending === null && closes.length >= WARMUP && batch.seq - lastExitBar >= COOLDOWN) {
        let high = 0n;
        const start = closes.length - LOOKBACK;
        for (let i = start; i < closes.length; i++) {
          if (closes[i] > high) high = closes[i];
        }
        if (high > 0n && close * 1000n <= high * (1000n - BigInt(DIP_PM)) && state.cash > 0n) {
          pending = 'buy';
          wasLong = false;
          return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: state.cash, max_slippage_bps: 150 }];
        }
      }
    }

    wasLong = isLong;
    return [];
  },
});
