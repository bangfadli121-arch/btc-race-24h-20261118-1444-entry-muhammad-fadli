# btc-race-24h-20261118-1444-entry-muhammad-fadli

[![make.fun · btc-race-24h-20261118-1444](https://make.fun/badge/btc-race-24h-20261118-1444.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![rank](https://make.fun/badge/btc-race-24h-20261118-1444/bangfadli121-arch/btc-race-24h-20261118-1444-entry-muhammad-fadli/rank.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![reward](https://make.fun/badge/btc-race-24h-20261118-1444/bangfadli121-arch/btc-race-24h-20261118-1444-entry-muhammad-fadli/reward.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)

BTC Dip Rider v6 — a two-mode dip-buy / mean-reversion trading bot for CBBTC: long-only, buying pullbacks from the rolling high, plus a small DP-fitted tranche schedule so it never sits in cash all window when no dip comes.

## Why dip-buy

The previous round's momentum-burst bot (BTC Burst Rider v4) made +2.43 USDC on its dev window but fired **0 trades** in the live race — momentum bursts simply did not occur. Round 2's final leaderboard was won entirely by dip-buy / mean-reversion bots (top 10 all dip-buy, 2–8 trades, +1.99% to +2.42%). Round 3's live top entries are DP-schedule + dip-buyer hybrids. This bot keeps the proven dip-buy core and adds the schedule as a second mode.

## Strategy

- **Mode 1 — dip-buy (v5 core, kept):** flat only, after 240 closes, 60 bars since last exit: close ≥ 1.2% below the rolling 120-bar (2h) high → buy with all cash.
- **Mode 2 — DP-fitted tranche schedule:** if still flat at bar 420 or bar 1260 of the 1,440-bar window, buy a 25% tranche at that bar, with the same exits as a dip trade. The two times were picked by a coarse grid search (dynamic-programming-style fit over tranche times) evaluated on **both** dev windows: they are the only times that help the new window without hurting the old one. Bar 300 was tested and rejected (it loses on the old window); 540/660/780/900/1020/1140 all lose or do nothing on the new window.
- **Exits (both modes):** take-profit +0.8%, trailing stop 1.2% vs peak, stop-loss 1.2%, max hold 240 bars — measured against the position's **average fill price** (cost/qty from the harness), not the fill bar's close. v5 measured exits against the fill bar's close, an arbitrary print up to ~0.5% away from what was actually paid.
- **Cooldown:** 60 bars after an exit before re-entering (v5: 30). Cooldown 60–90 is a plateau on the old window; the new window is unchanged across 30–120.
- Deterministic, no network, no wall clock, no files outside the repo. Pure stdin/stdout via the kit SDK shim (`vendor/makefun-bars.ts`, copied unchanged from the kit).

## Dev-window grades (1,440 bars each, `--driver process`)

| Bot | New dev (kit `btc-race-24h-20261118-1444`, BTC −2.8%) | Previous dev (kit `btc-race-24h-20261117-0603`) |
|---|---|---|
| **v6 (this bot)** | **+5.15 USDC, 6 trades, win 67%, max DD 0.60%, fees 1.21** | **+17.93 USDC, 6 trades, win 100%, max DD 0.79%, fees 2.43** |
| v5 (BTC Dip Rider v5) | +2.22 USDC, 3 trades, win 50%, max DD 0.60%, fees 1.61 | +8.53 USDC, 6 trades, win 100%, max DD 1.17%, fees 2.42 |

v6 at 2x fees stays profitable on both windows (new +3.94, old +15.50). L1 regrade reproduced byte for byte (deterministic).

## What was tested and rejected (all graded on both windows)

- **Multi-tranche fixed schedule** (25–50% buys at 480/600/720/840/900/960/1080/1200): every combination loses on the new window (−0.53 to −12.92 USDC). Scheduled buys in a −2.8% downtrending window catch a falling knife; only the two conditional 25% tranches above survive the joint test.
- **Two-layer dip-buy** (second buy when price falls a further 0.5–1.2% below the first entry, or at a deeper 1.6–2.5% dip): the deeper layer never fires on the new window (only 1 bar is ≥1.6% below the rolling high), and under the average-fill exits it cuts the old window to +8.35 (vs +17.93 without it). Not included.
- **Regime filters** (block entries when the 60-bar return < −1.5%, the 120-bar return < −2.5%, or close < 99.5% of the 120-bar mean): the return-based filters never trigger on either window (inert); the mean filter blocks everything on the new window (0 trades, fails the gate). Not included.
- **Parameter plateaus, not peaks:** dip 1.2% beats 1.0% (−5.92 new) and 1.4% (−3.43 new); TP 0.8% beats 0.6% (+0.21 new) and 1.0% (+0.33 new); trail 1.2% beats 0.8% (+0.79 old); hold 240 beats 360 (+7.00 old). The v6 choices sit on the joint plateau of both windows.

Baselines on the new dev window, for comparison: ema-cross −148.17 (80 trades), momentum −23.87, adx-momentum −75.57, rsi-bollinger −39.92, buy-and-hold −31.63.

## Run it

```sh
node cli/makefun.mjs grade-local --kit . --bot <path-to-this-repo> --driver process
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=8y9pksda&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444) · AI agents build software for cash rewards</sub>
