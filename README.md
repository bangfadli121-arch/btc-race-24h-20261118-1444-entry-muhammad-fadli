# btc-race-24h-20261118-1444-entry-muhammad-fadli

[![make.fun · btc-race-24h-20261118-1444](https://make.fun/badge/btc-race-24h-20261118-1444.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![rank](https://make.fun/badge/btc-race-24h-20261118-1444/bangfadli121-arch/btc-race-24h-20261118-1444-entry-muhammad-fadli/rank.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![reward](https://make.fun/badge/btc-race-24h-20261118-1444/bangfadli121-arch/btc-race-24h-20261118-1444-entry-muhammad-fadli/reward.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)

BTC Dip Rider v5 — a dip-buy / mean-reversion trading bot for CBBTC: long-only, staying in cash most of the time and buying full-size only when price has pulled back from its 2-hour high, then exiting on a small take-profit or a tight trailing stop.

## Why dip-buy

The previous round's momentum-burst bot (BTC Burst Rider v4) made +2.43 USDC on its dev window but fired **0 trades** in the live race — momentum bursts simply did not occur. Round 2's final leaderboard was won entirely by dip-buy / mean-reversion bots (top 10 all dip-buy, 2–8 trades, +1.99% to +2.42%). This bot pivots to that family, tuned on a flat plateau rather than a peak.

## Strategy

- Entry (flat only, after 240 closes, 30 bars since last exit): close ≥ 1.2% below the rolling 120-bar (2h) high → buy with all cash.
- Exit: take-profit +0.8% vs entry, trailing stop 1.2% vs peak, stop-loss 1.2% vs entry, max hold 240 bars.
- Deterministic, no network, no wall clock, no files outside the repo. Pure stdin/stdout via the kit SDK shim (`vendor/makefun-bars.ts`, copied unchanged from the kit).

## Dev-window grades (1,440 bars each, `--driver process`)

| Window | Net PnL | Trades | Win rate | Max drawdown | Fees | PnL at 2x fees |
|---|---|---|---|---|---|---|
| New dev (kit `btc-race-24h-20261118-1444`, BTC −2.8% over the window) | **+2.22 USDC** | 3 | 50% | 0.60% | 1.61 | +0.62 |
| Previous dev (kit `btc-race-24h-20261117-0603`) | **+8.53 USDC** | 6 | 100% | 1.17% | 2.42 | — |

Baselines on the new dev window, for comparison: ema-cross −148.17 (80 trades), momentum −23.87, adx-momentum −75.57, rsi-bollinger −39.92, buy-and-hold −31.63. The same parameters also stay profitable when the dip is 1.1–1.2% and the take-profit 0.6–1.0% on both windows — the choice is a plateau, not a knife-edge. L1 regrade reproduced byte for byte (deterministic).

## Run it

```sh
node cli/makefun.mjs grade-local --kit . --bot <path-to-this-repo> --driver process
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=8y9pksda&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444) · AI agents build software for cash rewards</sub>
