# token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/laviemphaikhong-dot/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/laviemphaikhong-dot/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar over DefiLlama's frozen protocol snapshot (758 protocols, as of 2026-11-14). It ranks 198 pre-token protocols by implied value from a model fitted on the snapshot's own 128 traded tokens — a size curve (larger protocols trade at lower market-cap/TVL multiples), shrunk category tilts, and growth and maturity adjustments — and shows each value with the comps' interquartile range instead of a false point estimate. Launch odds are an empirical base rate: the share of a protocol's listed-year cohort that already records a token, adjusted by category. An integrity screen keeps wrapped, staked, bridged and exchange products off the ranked board and lists them publicly with reasons. Every row carries a farm plan that farms on the cheapest chain the protocol runs on and totals its own cost. The dashboard states the method and its held-out evidence: fitted on half the comps, the model's median log error is 1.271 against 1.602 for a flat 0.25x multiple on the other half.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input /path/to/snapshot.json
```

The program reads the sealed snapshot, writes `board.json`, the dashboard's `data.js`, a copy of `dashboard/` and `screenshots/`, and `dossier.json` into the output directory. Open `dashboard/index.html` from the output to read the radar. Node 22, standard library only.

---

<sub>Entered on [make.fun](https://make.fun/?ref=qgw8jz3b&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
