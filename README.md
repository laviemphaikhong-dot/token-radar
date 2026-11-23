# token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/laviemphaikhong-dot/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/laviemphaikhong-dot/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar over DefiLlama's frozen protocol snapshot (758 protocols, as of 2026-11-14). It ranks 198 pre-token protocols by expected value: an implied value from a model fitted on the snapshot's own 128 traded tokens, times empirical launch odds. The value model is a size curve alone — a least-squares fit of ln(market cap / TVL) on ln(TVL), because larger protocols trade at lower multiples — with each value shown inside the comps' interquartile range (×0.31 to ×4.18) instead of as a false point estimate. Launch odds are a base rate: the share of a protocol's listed-year cohort that already records a token, adjusted by category; a peer-group reading (category × TVL band × age band) is printed beside them as a second opinion. Every row carries a farm verdict net of fees at a $1,000 ticket under a stated 5% drop-share assumption. An integrity screen keeps wrapped, staked, bridged and exchange products off the ranked board and lists them publicly with reasons, and the dashboard accounts for all 758 protocols in exactly one group each.

Model radar-4 is what survived radar-3's evidence, re-run harder. Every term was re-tested under leave-one-out over all 128 comps and walk-forward by listed year — the two designs that punish noise-fitting — and the program prints the full ladder itself: the size curve's median log error is 1.223 leave-one-out and 1.127 walk-forward (a typical miss of ×3.40 and ×3.09) against 1.591 / 1.404 for a flat 0.25x multiple, while the category tilt (1.314 / 1.158), the growth multiplier and the maturity multiplier all score worse than the curve they decorated, and fitted growth or age coefficients are worse again (the fitted age term's walk-forward error is 2.272). So the tilt, growth and maturity terms are gone. The printed range holds exactly 50% of held-out caps under both designs. The odds check the same way: cohort × category scores a Brier of 0.1978 cross-validated and 0.2703 walk-forward; the peer-group challenger (0.2150 / 0.2642) did not beat it and is labelled as tested, not adopted. Farm verdicts at the stated assumption: 26 FARM, 117 MARGINAL, 55 SKIP, with the best net rate $15.28 an hour — and the dashboard prints how the verdicts move when the drop-share assumption moves.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input /path/to/snapshot.json
```

The program reads the sealed snapshot, writes `board.json`, the dashboard's `data.js`, a copy of `dashboard/` and `screenshots/`, and `dossier.json` into the output directory. Open `dashboard/index.html` from the output to read the radar. Node 22, standard library only.

---

<sub>Entered on [make.fun](https://make.fun/?ref=qgw8jz3b&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
