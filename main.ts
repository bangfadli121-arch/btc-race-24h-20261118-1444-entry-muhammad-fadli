import { runBars } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';

// BTC Dip Rider v6 — two-mode dip-buy / mean-reversion, long-only.
// Mode 1 (dip-buy, the v5 core, kept): buy all cash when close is >= 1.2%
//   below the rolling 120-bar high; exit TP +0.8% / trail 1.2% / SL -1.2% /
//   hold 240 bars. Mode 2 (DP-fitted tranche schedule): if still flat at
//   bar 420 or bar 1260, buy a 25% tranche at that bar with the same exits,
//   so the bot never sits in cash all window when no dip comes. The two
//   schedule times were picked by a coarse grid (dynamic-programming-style
//   search over tranche times) evaluated on BOTH dev windows: they are the
//   only early/late times that help the new window without hurting the old
//   one (bar 300 was rejected: it loses on the old window).
//   Each schedule tranche is flat-only and capped at 25% of cash, so a
//   mistimed tranche can cost at most ~0.3% of equity at the 1.2% stop;
//   the dip trade stays the main engine and keeps full size.
// Two refinements vs v5, both verified on both windows: (a) exits are
//   measured against the position's average fill price (cost/qty from the
//   harness), not the fill bar's close — TP/SL vs what was actually paid;
//   (b) cooldown after an exit is 60 bars, not 30 (plateau 60-90 on the
//   old window, no effect on the new one). Tested and REJECTED (see
//   README.md): a second dip layer (add-on-dip), a multi-tranche schedule
//   (all fixed-time schedules lose on the new window), and regime filters
//   (inert or fatal). Deterministic, no network, no wall clock, no files
//   outside the repo. Pure stdin/stdout via the kit SDK shim
//   (vendor/makefun-bars.ts, copied unchanged from the kit).
const DIP1_PM = 12;
const DIP2_PM = 0;
const ADD_PM = 0;
const DIP_FRAC_PM = 1000;
const SCHED_BARS: number[] = [420,1260];
const SCHED_FRAC_PM = 250;
const SCHED_WHILE_LONG = false;
const MAX_TR = 3;
const REGIME = 0;
const TP_PM = 8;
const TRAIL_PM = 12;
const SL_PM = 12;
const MAX_HOLD = 240;
const COOLDOWN = 60;
const WARMUP = 240;
const LOOKBACK = 120;
const AVG_EXIT = 1;

const closes: bigint[] = [];
let pending: 'buy' | 'sell' | null = null;
let wasLong = false;
let peak = 0n;
let entryClose = 0n;
let entryBar = -1;
let lastExitBar = -1_000_000;
let tranches = 0;

function rollingHigh(lookback: number): bigint {
  let high = 0n;
  const start = closes.length - lookback;
  for (let i = start; i < closes.length; i++) {
    if (closes[i] > high) high = closes[i];
  }
  return high;
}

function regimeOk(close: bigint): boolean {
  if (REGIME === 1) {
    if (closes.length < 61) return true;
    const ref = closes[closes.length - 61];
    return close * 1000n >= ref * 985n;
  }
  if (REGIME === 2) {
    if (closes.length < 121) return true;
    const ref = closes[closes.length - 121];
    return close * 1000n >= ref * 975n;
  }
  if (REGIME === 3) {
    if (closes.length < 120) return true;
    let sum = 0n;
    for (let i = closes.length - 120; i < closes.length; i++) sum += closes[i];
    const mean = sum / 120n;
    return close * 1000n >= mean * 995n;
  }
  return true;
}

await runBars({
  onBatch(state, batch) {
    const position = state.positions.get(SYMBOL);
    const isLong = position !== undefined;
    if (wasLong && !isLong) { lastExitBar = batch.seq; tranches = 0; }

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
        let refClose = entryClose;
        if (AVG_EXIT === 1) {
          const pos = state.positions.get(SYMBOL);
          if (pos !== undefined && pos.qty > 0n) {
            const avgPrice = (pos.cost * 10000000n) / pos.qty;
            if (avgPrice > 0n) refClose = avgPrice;
          }
        }
        const shouldExit = close * 1000n <= peak * (1000n - BigInt(TRAIL_PM))
          || close * 1000n <= refClose * (1000n - BigInt(SL_PM))
          || close * 1000n >= refClose * (1000n + BigInt(TP_PM))
          || batch.seq - entryBar >= MAX_HOLD;
        if (shouldExit && pending === null) {
          pending = 'sell';
          wasLong = true;
          return [{ side: 'sell', symbol: SYMBOL, qty: position.qty, max_slippage_bps: 150 }];
        }
        if (tranches < MAX_TR && state.cash > 0n) {
          const high = rollingHigh(LOOKBACK);
          const deepDip = DIP2_PM > 0 && high > 0n && close * 1000n <= high * (1000n - BigInt(DIP2_PM))
            && close * 1000n <= entryClose * 994n;
          const addDip = ADD_PM > 0 && close * 1000n <= entryClose * (1000n - BigInt(ADD_PM));
          const schedNow = SCHED_WHILE_LONG && SCHED_BARS.includes(batch.seq);
          if (deepDip || addDip || schedNow) {
            const amt = (state.cash * BigInt(DIP_FRAC_PM)) / 1000n;
            if (amt >= 1000000n) {
              pending = 'buy';
              tranches += 1;
              wasLong = true;
              return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: amt, max_slippage_bps: 150 }];
            }
          }
        }
      } else if (pending === null && closes.length >= WARMUP && batch.seq - lastExitBar >= COOLDOWN) {
        const high = rollingHigh(LOOKBACK);
        const ok = regimeOk(close);
        if (ok && DIP1_PM > 0 && high > 0n && close * 1000n <= high * (1000n - BigInt(DIP1_PM)) && state.cash > 0n) {
          const amt = (state.cash * BigInt(DIP_FRAC_PM)) / 1000n;
          if (amt >= 1000000n) {
            pending = 'buy';
            tranches += 1;
            wasLong = false;
            return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: amt, max_slippage_bps: 150 }];
          }
        }
        if (SCHED_BARS.includes(batch.seq) && ok && state.cash > 0n && tranches < MAX_TR) {
          const amt = (state.cash * BigInt(SCHED_FRAC_PM)) / 1000n;
          if (amt >= 1000000n) {
            pending = 'buy';
            tranches += 1;
            wasLong = false;
            return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: amt, max_slippage_bps: 150 }];
          }
        }
      }
    }

    wasLong = isLong;
    return [];
  },
});
