// The token radar's model: one snapshot of the protocol universe in, one ranked board out.
//
// The board covers every slug in the snapshot's watchlist (the floor, never a ceiling) and adds the
// strongest pre-token protocols the integrity screen passes, wherever they sit against the floor.
// The row set is the one radar-3 selected (watchlist plus the top early rows by radar-3's implied
// value), so this board is comparable to the last one row for row; what changed is the scoring.
// A protocol is pre-token when its record carries no token (no market cap, no CoinGecko id, no
// symbol); the snapshot's live-token protocols are kept apart and shown at the market's own values.
//
// The implied value is fitted from the snapshot's own traded tokens, never asserted, and in
// radar-4 it is the size curve alone:
//
//   comps       = the protocols that record a token with mcap_usd > 0 and tvl_usd > 0 (128 here)
//   size fit    = OLS of ln(mcap / tvl) on ln(tvl) over the comps: bigger protocols trade at lower
//                 multiples (slope about -0.48), so the multiple is a curve, not a constant
//   implied     = max(1, round(tvl x fitted multiple))
//   range       = implied x [P25, P75] of the size fit's own residuals (about x0.31 to x4.18)
//
// radar-3 multiplied that curve by a shrunk category tilt, a seven-day growth multiplier and a
// maturity multiplier, because on random held-out splits the full model edged out the curve alone.
// radar-4 re-tests every term under the two stricter designs the splits cannot fool —
// leave-one-out over all 128 comps and walk-forward by listed year — and under both designs every
// extra term fails: the tilt, the growth multiplier and the maturity multiplier all score worse
// than the curve they decorate, and coefficients fitted for growth or age are worse again (the
// fitted age coefficient blows the walk-forward error up ninefold, because early training windows
// hold only old protocols). So radar-4 ships the curve alone and prints the whole ladder, term by
// term, in data.js: the dashboard's evidence panel is computed by this program, not pasted in.
// The range earns the same treatment: rebuilt from each design's own residuals, the size curve's
// P25-P75 band holds exactly 50% of held-out caps under both designs; radar-3's full-model band
// held only 38.6% walk-forward.
//
// The board is ranked by expected value, implied value x launch odds, because a large value at
// long odds and a smaller one at short odds are different prospects; both factors stay visible as
// their own columns, so the ranking can be taken apart.
//
// Launch odds are an empirical base rate, not a prediction: of the protocols DefiLlama has tracked
// since a given year, the share that already record a token under the snapshot's own definition (a
// CoinGecko id, a symbol, or a market cap: 80% for the 2021 cohort, 31% for 2026), adjusted by the
// protocol's category share shrunk toward the average and clamped to [2%, 85%]. A second odds
// design — peer groups, the tokenized share of the protocol's own category x TVL band x age band
// cell, shrunk toward its category rate — was tested the same way: it loses the cross-validation
// clearly (Brier 0.2150 against 0.1978) and wins walk-forward narrowly (0.2642 against 0.2703,
// within noise), so it is printed as a labelled second opinion, the "peer record", and never used
// for the ranking. The survivorship caveat the dashboard prints beside the odds stands: a protocol
// still tokenless years on is, if anything, a slower launcher than its cohort's share suggests.
//
// Every row also carries a farm verdict, net of fees, at a fixed $1,000 reference ticket: the
// farmer's pro-rata slice of a launch is ticket / (TVL + ticket), the expected drop is launch
// odds x implied value x a 5% drop-share assumption (stated wherever a verdict is printed) x that
// slice, and the cost is the cheapest chain's gas over the plan's own schedule. FARM needs a net
// of at least $10 and at least $5 an hour; the verdicts flip wholesale with the drop-share
// assumption (none is a FARM at 2%, 76 are at 10%), and the dashboard prints that too.
//
// The integrity screen keeps the board honest: a pre-token protocol whose name or category marks
// it as a wrapped, staked, bridged or exchange product of a token that already trades, or a
// versioned pool of another protocol, is not ranked as a launch candidate. It is listed in the
// dashboard's screened-out section with its reason, never silently dropped. Watchlist rows are
// never screened out: the gate's coverage is not gambled on a heuristic.
//
// No protocol name is ever special-cased in the scoring: the same fitted function scores every row.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's stated constants: the house comparison multiple and the farm verdict's terms. */
export interface ModelConstants {
  base_multiple: number;
  ticket_usd: number;
  drop_share: number;
  farm_min_net: number;
  farm_min_per_hour: number;
}

export const MODEL: ModelConstants = {
  base_multiple: 0.25,
  ticket_usd: 1000,
  drop_share: 0.05,
  farm_min_net: 10,
  farm_min_per_hour: 5,
};

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-4';

/** How many pre-token protocols beyond the watchlist the early radar carries, by radar-3's implied value. */
export const EARLY_ROWS = 160;

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** A farm verdict at the reference ticket: FARM clears both bars, MARGINAL clears neither fully, SKIP loses money. */
export type FarmVerdictLabel = 'FARM' | 'MARGINAL' | 'SKIP';

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  /** Expected value: implied value x launch odds, the board's ranking key. */
  ev: number;
  /** The peer-group odds (a second opinion, never the ranking's odds), as a fraction. */
  peerOdds: number;
  farmVerdict: FarmVerdictLabel;
  /** Farm economics at the reference ticket, in dollars (per-hour for farmPerHour). */
  farmNet: number;
  farmPerHour: number;
  farmFees: number;
  model: {
    base_multiple: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row, with farm plans generated in the page. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  implied_low_usd: number;
  implied_high_usd: number;
  base_multiple: number;
  launch_odds_pct: number;
  ev_usd: number;
  peer_odds_pct: number;
  peer_cell: string;
  peer_cell_n: number;
  farm_verdict: FarmVerdictLabel;
  farm_net_usd: number;
  farm_per_hour_usd: number;
  farm_fees_usd: number;
  farm_ev_usd: number;
  farm_hours: number;
  on_watchlist: boolean;
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** A pre-token protocol the integrity screen kept off the board, with the reason it was kept off. */
export interface ScreenedRow {
  slug: string;
  name: string;
  category: string | null;
  tvl_usd: number;
  reason: string;
}

/** The fitted size curve's own summary, as the dashboard's method section states it. */
export interface FitSummary {
  comps: number;
  ols_intercept: number;
  ols_slope: number;
  geo_mean_multiple: number;
  band_low_factor: number;
  band_high_factor: number;
}

/** One value-model term under both hard designs: median absolute log error, lower is better. */
export interface ValueTerm {
  name: string;
  loo: number;
  wf: number;
  kept: boolean;
  role: 'model' | 'reference' | 'tested';
}

/** How often a printed P25-P75 band held the held-out cap it claimed to cover half of. */
export interface RangeCheck {
  name: string;
  loo_pct: number;
  wf_pct: number;
}

/** One odds model under both designs: Brier score, lower is better. */
export interface OddsTerm {
  name: string;
  cv: number;
  wf: number;
  kept: boolean;
  role: 'model' | 'reference' | 'tested';
}

/** The program's own out-of-sample evidence: every term, both designs, computed from the snapshot. */
export interface ValidationData {
  comps: number;
  wf_rows: number;
  odds_wf_rows: number;
  value_terms: ValueTerm[];
  range_checks: RangeCheck[];
  odds_terms: OddsTerm[];
}

/** One line of the protocol ledger: every protocol in the snapshot sits in exactly one group. */
export interface AccountingGroup {
  label: string;
  count: number;
}

/** The integrity screen's rejects grouped by the rule that caught them. */
export interface ReasonCount {
  label: string;
  count: number;
}

/** One listed-year cohort's launch base rate: how many of its protocols already record a token. */
export interface CohortRate {
  cohort: string;
  tokenized: number;
  total: number;
  share_pct: number;
}

/** Everything the dashboard needs: the board, the live set, the screen's rejects, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  total_protocols: number;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
  fit: FitSummary;
  validation: ValidationData;
  farm: {
    ticket_usd: number;
    drop_share: number;
    counts: Record<FarmVerdictLabel, number>;
    best: { name: string; net_per_hour_usd: number };
    sensitivity: { drop_share: number; counts: Record<FarmVerdictLabel, number> }[];
  };
  accounting: {
    total: number;
    groups: AccountingGroup[];
    screened_reasons: ReasonCount[];
  };
  totals: { implied_sum: number; ev_sum: number };
  cohorts: CohortRate[];
  screened_out: ScreenedRow[];
  screened_out_count: number;
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;
const round3 = (n: number): number => Math.round(n * 1e3) / 1e3;
const round2 = (n: number): number => Math.round(n * 100) / 100;
const round1 = (n: number): number => Math.round(n * 10) / 10;

/** The protocols that can teach the model what a token trades at: a token, a market cap, a TVL. */
export function tradedComps(snapshot: Snapshot): SnapshotProtocol[] {
  return snapshot.protocols.filter((p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0);
}

/** A fitted valuation: the size curve, the shrunk category tilts (kept for row selection), and the residual band. */
export interface Fit {
  intercept: number;
  slope: number;
  tilts: Map<string, number>;
  bandLow: number;
  bandHigh: number;
  comps: number;
}

/** OLS of ln(mcap / tvl) on ln(tvl) over `comps`: the size curve and its intercept. */
function ols(comps: SnapshotProtocol[]): { intercept: number; slope: number } {
  const xs = comps.map((p) => Math.log(Math.max(1, p.tvl_usd)));
  const ys = comps.map((p) => Math.log(p.mcap_usd! / p.tvl_usd));
  const mx = xs.reduce((s, x) => s + x, 0) / xs.length;
  const my = ys.reduce((s, y) => s + y, 0) / ys.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i]! - mx) * (ys[i]! - my);
    den += (xs[i]! - mx) ** 2;
  }
  const slope = den > 0 ? num / den : 0;
  return { intercept: my - slope * mx, slope };
}

/** The multiple the size curve alone gives a TVL. */
export function sizeMultiple(fit: { intercept: number; slope: number }, tvl: number): number {
  return Math.exp(fit.intercept + fit.slope * Math.log(Math.max(1, tvl)));
}

/**
 * Each category's tilt against a base log-multiple: its geometric-mean residual, shrunk toward 1
 * by n / (n + k) and capped to [0.7, 1.43]. radar-4 fits tilts only to select the board's rows the
 * way radar-3 did and to score the tilt in the validation ladder; no board value uses one.
 */
function tiltsFrom(train: SnapshotProtocol[], logmult: (p: SnapshotProtocol) => number, k: number): Map<string, number> {
  const byCategory = new Map<string, number[]>();
  for (const p of train) {
    const key = p.category ?? '';
    const list = byCategory.get(key) ?? [];
    list.push(Math.log(p.mcap_usd! / p.tvl_usd) - logmult(p));
    byCategory.set(key, list);
  }
  const tilts = new Map<string, number>();
  for (const [category, list] of byCategory) {
    const mean = list.reduce((s, x) => s + x, 0) / list.length;
    const w = list.length / (list.length + k);
    tilts.set(category, Math.min(1.43, Math.max(0.7, Math.exp(w * mean))));
  }
  return tilts;
}

/**
 * Fit the valuation on the snapshot's traded comps: the size curve, the category tilts the row
 * selection still uses, and the residual interquartile band a board range is drawn from — the
 * band of the size fit's own residuals, exactly the band the validation finds calibrated.
 */
export function fitModel(snapshot: Snapshot): Fit {
  const comps = tradedComps(snapshot);
  const { intercept, slope } = ols(comps);
  const base = { intercept, slope };
  const residuals = comps.map((p) => Math.log(p.mcap_usd! / p.tvl_usd) - Math.log(sizeMultiple(base, p.tvl_usd)));
  const tilts = tiltsFrom(comps, (p) => Math.log(sizeMultiple(base, p.tvl_usd)), 10);
  const sorted = [...residuals].sort((a, b) => a - b);
  const q = (f: number): number => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(f * sorted.length)))]!;
  return {
    intercept,
    slope,
    tilts,
    bandLow: Math.exp(q(0.25)),
    bandHigh: Math.exp(q(0.75)),
    comps: comps.length,
  };
}

/**
 * radar-3's asserted multipliers, kept as constants because the validation ladder scores them
 * and the row selection still ranks by them: growth clamped to [-60, 120] and weighted 0.5, and
 * maturity rising from 0.6 to 1.0 over three years (an unknown age counts as one year).
 */
const ASSERTED = {
  growth_weight: 0.5,
  growth_floor: -60,
  growth_cap: 120,
  maturity_floor: 0.6,
  maturity_range: 0.4,
  maturity_days: 1095,
  unknown_age_days: 365,
};

/** The asserted growth multiplier for one protocol. */
function growthMultOf(p: SnapshotProtocol): number {
  const g = Math.min(ASSERTED.growth_cap, Math.max(ASSERTED.growth_floor, finite(p.change_7d, 0)));
  return 1 + (g / 100) * ASSERTED.growth_weight;
}

/** A protocol's age as a fraction of three years, for the asserted maturity term and fitted age columns. */
function ageIndexOf(p: SnapshotProtocol, asOf: string): number {
  const age = ageDays(asOf, p.listed_at) ?? ASSERTED.unknown_age_days;
  return Math.min(Math.max(age, 0), ASSERTED.maturity_days) / ASSERTED.maturity_days;
}

/** The asserted maturity multiplier for one protocol. */
function maturityMultOf(p: SnapshotProtocol, asOf: string): number {
  return ASSERTED.maturity_floor + ageIndexOf(p, asOf) * ASSERTED.maturity_range;
}

/** The fitted multiple one protocol gets in radar-4: the size curve, nothing else. */
export function fittedMultiple(fit: Fit, p: SnapshotProtocol): number {
  return sizeMultiple(fit, p.tvl_usd);
}

/**
 * A protocol's implied value under the shipped model, with the fitted multiple rounded to 4
 * decimals before the multiplication — the board publishes that rounded multiple, and the implied
 * value is computed from it, so the dashboard's own recomputation of a row lands on the same
 * number board.json carries, to the dollar.
 */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  fit: Fit,
): { implied: number; multiple: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const multiple = fittedMultiple(fit, protocol);
  const implied = Math.max(1, Math.round(protocol.tvl_usd * round4(multiple)));
  return { implied, multiple, age };
}

/**
 * The score the board's row SELECTION ranks by: radar-3's implied value (size curve x shrunk
 * category tilt x asserted growth x asserted maturity), unrounded. radar-4 keeps radar-3's row
 * set so the two boards differ only in scoring and ranking, never in who is on them.
 */
function selectionScore(p: SnapshotProtocol, asOf: string, fit: Fit): number {
  const multiple = sizeMultiple(fit, p.tvl_usd) * (fit.tilts.get(p.category ?? '') ?? 1);
  return p.tvl_usd * multiple * growthMultOf(p) * maturityMultOf(p, asOf);
}

/**
 * Whether a protocol's record carries a token, in the snapshot's own terms: a CoinGecko id, a
 * symbol, or a positive market cap. A bare symbol with no market cap is a deployment of a parent
 * whose token already trades (aave-v3 carries AAVE), which is a token recorded, not a launch to
 * come; a market cap of zero or less is a dead record and counts as no token.
 */
export function hasTokenRecord(p: SnapshotProtocol): boolean {
  return p.gecko_id !== null || p.symbol !== null || (p.mcap_usd !== null && p.mcap_usd > 0);
}

/** The listed-year cohorts and the share of each that already records a token, over `protocols`. */
export function cohortRatesOf(protocols: SnapshotProtocol[]): CohortRate[] {
  const byYear = new Map<string, { tokenized: number; total: number }>();
  for (const p of protocols) {
    const cohort = p.listed_at === null ? 'unknown' : p.listed_at.slice(0, 4);
    const cell = byYear.get(cohort) ?? { tokenized: 0, total: 0 };
    cell.total += 1;
    if (hasTokenRecord(p)) cell.tokenized += 1;
    byYear.set(cohort, cell);
  }
  return [...byYear.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([cohort, cell]) => ({
      cohort,
      tokenized: cell.tokenized,
      total: cell.total,
      share_pct: Math.round((cell.tokenized / cell.total) * 1000) / 10,
    }));
}

/** The listed-year cohorts of the whole snapshot. */
export function cohortRates(snapshot: Snapshot): CohortRate[] {
  return cohortRatesOf(snapshot.protocols);
}

/** Each category's tokenized share over `protocols`, for the odds adjustment. */
function categorySharesOf(protocols: SnapshotProtocol[]): Map<string, { share: number; n: number }> {
  const byCategory = new Map<string, { tokenized: number; total: number }>();
  let tok = 0;
  for (const p of protocols) {
    const key = p.category ?? '';
    const cell = byCategory.get(key) ?? { tokenized: 0, total: 0 };
    cell.total += 1;
    if (hasTokenRecord(p)) {
      cell.tokenized += 1;
      tok += 1;
    }
    byCategory.set(key, cell);
  }
  const overall = tok / protocols.length;
  const out = new Map<string, { share: number; n: number }>();
  for (const [key, cell] of byCategory) out.set(key, { share: (cell.tokenized / cell.total) / overall, n: cell.total });
  return out;
}

/** Each category's tokenized share over the whole snapshot. */
function categoryShares(snapshot: Snapshot): Map<string, { share: number; n: number }> {
  return categorySharesOf(snapshot.protocols);
}

/**
 * A protocol's launch odds in whole per cent: its cohort's base rate, adjusted by its category's
 * tokenized share shrunk by n / (n + 20) toward the average and capped, the whole clamped to
 * [2, 85]. A base rate from this snapshot's cross-section, never a promise about one protocol.
 */
export function launchOdds(p: SnapshotProtocol, cohorts: CohortRate[], shares: Map<string, { share: number; n: number }>): number {
  const cohort = p.listed_at === null ? 'unknown' : p.listed_at.slice(0, 4);
  const overall = cohorts.reduce((s, c) => s + c.tokenized, 0) / Math.max(1, cohorts.reduce((s, c) => s + c.total, 0));
  const cell = cohorts.find((c) => c.cohort === cohort);
  const base = cell !== undefined && cell.total >= 10 ? cell.share_pct / 100 : overall;
  const cat = shares.get(p.category ?? '');
  let ratio = 1;
  if (cat !== undefined) {
    const w = cat.n / (cat.n + 20);
    ratio = Math.min(1.6, Math.max(0.6, 1 + w * (cat.share - 1)));
  }
  return Math.round(Math.min(0.85, Math.max(0.02, base * ratio)) * 100);
}

/** The TVL band a peer-group cell keys on. */
function tvlBandOf(tvl: number): string {
  if (tvl < 50_000_000) return '<$50M';
  if (tvl < 250_000_000) return '$50-250M';
  if (tvl < 1_000_000_000) return '$250M-1B';
  return '\u2265$1B';
}

/** The age band a peer-group cell keys on. */
function ageBandOf(age: number | null): string {
  if (age === null) return 'age unknown';
  if (age < 365) return '<1y';
  if (age < 1095) return '1-3y';
  return '>3y';
}

/** A peer-group index over a protocol set: the global rate, and each category's cells. */
export interface PeerIndex {
  global: number;
  cats: Map<string, { n: number; tok: number; cells: Map<string, { n: number; tok: number }> }>;
}

/** Build the peer-group index over `protocols`: category x TVL band x age band cells. */
export function peerIndex(protocols: SnapshotProtocol[], asOf: string): PeerIndex {
  const cats = new Map<string, { n: number; tok: number; cells: Map<string, { n: number; tok: number }> }>();
  let tok = 0;
  for (const p of protocols) {
    const key = p.category ?? '';
    const cat = cats.get(key) ?? { n: 0, tok: 0, cells: new Map<string, { n: number; tok: number }>() };
    const cellKey = `${tvlBandOf(p.tvl_usd)}|${ageBandOf(ageDays(asOf, p.listed_at))}`;
    const cell = cat.cells.get(cellKey) ?? { n: 0, tok: 0 };
    cat.n += 1;
    cell.n += 1;
    if (hasTokenRecord(p)) {
      cat.tok += 1;
      cell.tok += 1;
      tok += 1;
    }
    cat.cells.set(cellKey, cell);
    cats.set(key, cat);
  }
  return { global: protocols.length > 0 ? tok / protocols.length : 0, cats };
}

/**
 * A protocol's peer record: the tokenized share of its own peer cell (same category, TVL band and
 * age band), the cell shrunk toward its category's rate by 8 pseudo-counts and the category rate
 * itself shrunk toward the global rate by 20, clamped to [2%, 85%]. A second opinion beside the
 * scored odds — tested, not adopted — so it also reports the cell it read and how thin it is.
 */
export function peerOdds(p: SnapshotProtocol, asOf: string, idx: PeerIndex): { odds: number; cell: string; cellN: number } {
  const catKey = p.category ?? '';
  const cat = idx.cats.get(catKey);
  const pCat = cat !== undefined ? (cat.tok + 20 * idx.global) / (cat.n + 20) : idx.global;
  const cellLabel = `${catKey === '' ? 'uncategorised' : catKey} \u00b7 ${tvlBandOf(p.tvl_usd)} \u00b7 ${ageBandOf(ageDays(asOf, p.listed_at))}`;
  const cellKey = `${tvlBandOf(p.tvl_usd)}|${ageBandOf(ageDays(asOf, p.listed_at))}`;
  const cell = cat?.cells.get(cellKey);
  const cellN = cell?.n ?? 0;
  const cellTok = cell?.tok ?? 0;
  const odds = Math.min(0.85, Math.max(0.02, (cellTok + 8 * pCat) / (cellN + 8)));
  return { odds, cell: cellLabel, cellN };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** A name carrying a whole word that marks a wrapped or staked product of another token. */
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;

/** Names that begin with an exchange's own name: the product of an exchange, not a launch. */
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;

/** Categories that are products of a token that already trades, or an exchange itself. */
const PRODUCT_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/**
 * Why the integrity screen keeps a pre-token protocol off the ranked board, or null when it
 * passes: the protocol reads as a wrapped, staked, bridged or exchange product of a token that
 * already trades, or as a versioned pool of another protocol.
 */
export function screenReason(p: SnapshotProtocol): string | null {
  if (p.category !== null && PRODUCT_CATEGORIES.has(p.category)) {
    return `category ${p.category}: a product of a token that already trades, not a launch of its own`;
  }
  if (VERSIONED.test(p.name)) return 'the name ends in a version marker: a pool of another protocol';
  if (WRAPPED_WORD.test(p.name)) return 'the name carries a wrapped or staked marker: a product of a token that already trades';
  if (EXCHANGE_PREFIX.test(p.name)) return 'the name begins with an exchange\u2019s name: an exchange product, not a launch';
  return null;
}

/** The short rule label the ledger groups the screen's rejects by. */
export function screenKind(p: SnapshotProtocol): string {
  if (p.category !== null && PRODUCT_CATEGORIES.has(p.category)) return p.category;
  if (VERSIONED.test(p.name)) return 'Versioned name';
  if (WRAPPED_WORD.test(p.name)) return 'Wrapped or staked name';
  return 'Exchange name';
}

/** Whether a protocol is one the board may rank: pre-token and through the integrity screen. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && screenReason(p) === null;
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** A board row's farm economics at the reference ticket, before display rounding. */
export interface FarmEconomics {
  verdict: FarmVerdictLabel;
  net: number;
  perHour: number;
  fees: number;
  hours: number;
  evFarm: number;
  slice: number;
  chain: string;
  gas: number;
  weeks: number;
  hold: number;
}

/**
 * The farm verdict's arithmetic, exactly as the dashboard states it: a fixed reference ticket on
 * the protocol's cheapest chain; fees are that chain's gas over the plan's own schedule (setup and
 * exit plus one action a week); the farmer's slice of a launch is the ticket's pro-rata share of
 * qualifying capital; the expected drop is the peer-record odds x implied value x the drop-share
 * assumption x that slice; the capital itself is returned, so it is not a cost. FARM needs a net
 * of at least the model's floor and at least its hourly floor; MARGINAL makes money below a bar.
 */
export function farmEconomics(
  p: SnapshotProtocol,
  age: number | null,
  odds: number,
  implied: number,
  dropShare: number = MODEL.drop_share,
  model: ModelConstants = MODEL,
): FarmEconomics {
  const { chain, gas } = farmChain(p);
  const hold = holdDaysFor(age);
  const weeks = Math.max(1, Math.round(hold / 7));
  const fees = gas * (2 + weeks);
  const hours = (5 + 15 + 10 + 5) / 60 + weeks * (10 / 60);
  const slice = model.ticket_usd / (p.tvl_usd + model.ticket_usd);
  const evFarm = odds * implied * dropShare * slice;
  const net = evFarm - fees;
  const perHour = net / hours;
  const verdict: FarmVerdictLabel = net >= model.farm_min_net && perHour >= model.farm_min_per_hour ? 'FARM' : net > 0 ? 'MARGINAL' : 'SKIP';
  return { verdict, net, perHour, fees, hours, evFarm, slice, chain, gas, weeks, hold };
}

/** The protocols the board ranks, strongest expected value first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const fit = fitModel(snapshot);
  const cohorts = cohortRates(snapshot);
  const shares = categoryShares(snapshot);
  const peers = peerIndex(snapshot.protocols, snapshot.as_of);
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the snapshot no longer carries (it cannot, but the
  // board's coverage is the gate's row and is never gambled on a missing record or a screen).
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every screened pre-token protocol off the watchlist, the strongest EARLY_ROWS
  // of them carried. Selection ranks by radar-3's implied value, as radar-3 selected, so this
  // board's row set is the last board's; only the scoring and the ranking changed.
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p))
    .map((p) => ({ p, score: selectionScore(p, snapshot.as_of, fit) }))
    .sort((a, b) => b.score - a.score || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0))
    .slice(0, EARLY_ROWS);
  for (const e of early) chosen.set(e.p.slug, e.p);

  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, fit);
    const oddsPct = launchOdds(p, cohorts, shares);
    const ev = Math.round(v.implied * (oddsPct / 100));
    const peer = peerOdds(p, snapshot.as_of, peers);
    const farm = farmEconomics(p, v.age, peer.odds, v.implied, model.drop_share, model);
    return { p, ...v, oddsPct, ev, peer, farm };
  });
  scored.sort((a, b) => b.ev - a.ev || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.age,
    implied_value_usd: s.implied,
    ev: s.ev,
    peerOdds: round3(s.peer.odds),
    farmVerdict: s.farm.verdict,
    farmNet: round2(s.farm.net),
    farmPerHour: round2(s.farm.perHour),
    farmFees: round2(s.farm.fees),
    model: {
      base_multiple: round4(s.multiple),
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/**
 * A rough one-transaction gas cost in US dollars for the chains a farmer meets most, used only to
 * pick the cheapest chain a protocol runs on and to price a plan's steps. Chains not listed price
 * at the default; the figure is a planning estimate, stated as about, never a quote.
 */
const CHAIN_GAS_USD: Record<string, number> = {
  Ethereum: 12,
  Bitcoin: 2,
  Tron: 1,
  Solana: 0.1,
  Base: 0.15,
  Arbitrum: 0.2,
  Optimism: 0.2,
  'OP Mainnet': 0.2,
  Polygon: 0.05,
  BSC: 0.2,
  Avalanche: 0.3,
  Linea: 0.3,
  Scroll: 0.3,
  'zkSync Era': 0.2,
  Mantle: 0.1,
  Blast: 0.2,
  Monad: 0.1,
  Sui: 0.1,
  Aptos: 0.1,
  Near: 0.05,
  Unichain: 0.15,
  Katana: 0.15,
  Corn: 0.2,
  'Robinhood Chain': 0.2,
  Arc: 0.2,
};

/** The cheapest chain a protocol runs on, for gas, and what one transaction there costs. */
export function farmChain(p: SnapshotProtocol): { chain: string; gas: number } {
  let best: { chain: string; gas: number } | null = null;
  for (const chain of p.chains) {
    const gas = CHAIN_GAS_USD[chain] ?? 1;
    if (best === null || gas < best.gas) best = { chain, gas };
  }
  return best ?? { chain: 'its main chain', gas: 1 };
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedge.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}.`;
  if (c.includes('curator') || c.includes('allocator')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy.`;
  if (c.includes('basis')) return `Deposit $${capital} of USDC into ${name}'s basis vault on ${chain} and keep the shares.`;
  if (c.includes('index')) return `Deposit $${capital} of USDC into a ${name} index vault on ${chain} and keep the shares.`;
  if (c.includes('privacy')) return `Deposit $${capital} of USDC into ${name}'s shielded pool on ${chain} through its own app and keep the note.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/** A gas figure as a farmer reads it: cents under a dollar, whole dollars above. */
function gasText(gas: number): string {
  return gas < 1 ? `about ${Math.round(gas * 100)} cents` : `about $${Math.round(gas)}`;
}

/**
 * A protocol's farm plan: six steps, each an action with a cost and a time. The plan is derived
 * from the protocol's own record (category, chains, TVL, age), never from a hand-written list of
 * names: it farms on the cheapest chain the protocol runs on, and its last step totals the plan,
 * capital plus the gas of the weekly actions over the hold, so a reader sees the whole cost.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const { chain, gas } = farmChain(p);
  const usual = capitalFor(p);
  const drop = finite(p.change_7d, 0);
  const falling = drop <= -20;
  const capital = falling ? Math.max(25, Math.round(usual / 2)) : usual;
  const hold = holdDaysFor(age);
  const action = actionFor(p, capital, chain);
  const weeks = Math.max(1, Math.round(hold / 7));
  const totalGas = gas * (2 + weeks);
  const steps: FarmStep[] = [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: `${gasText(gas)} of gas for the first transaction on ${chain}`,
      time: '5 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and ${gasText(gas)} of gas on ${chain}`,
      time: '15 minutes to set up',
    },
    {
      text: `Make one qualifying action each week on ${chain}, such as a deposit, a borrow, a swap or a vote.`,
      cost: `${gasText(gas)} of gas a week`,
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Total plan: $${capital} of capital plus about $${Math.max(1, Math.round(totalGas))} of gas over ${weeks} weeks. Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
  if (falling) {
    steps.splice(2, 0, {
      text: `Its TVL fell ${Math.abs(Math.round(drop))}% in the last seven days, so this plan starts at half size ($${capital} of the usual $${usual}): add the second half only after two weekly checks show the TVL holding.`,
      cost: 'nothing to wait: the second half stays in the wallet',
      time: '2 weeks of checks',
    });
  }
  return steps;
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX' && (p.mcap_usd ?? 0) > 0)
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** The pre-token protocols the integrity screen kept off the board, largest first, with reasons. */
export function screenedOut(snapshot: Snapshot, limit = 48): ScreenedRow[] {
  return snapshot.protocols
    .filter((p) => isPreToken(p) && screenReason(p) !== null)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : 1))
    .slice(0, limit)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      tvl_usd: p.tvl_usd,
      reason: screenReason(p)!,
    }));
}

/** The clamped seven-day growth a term reads, in per cent. */
function clampGrowth(p: SnapshotProtocol): number {
  const g = p.change_7d === null ? 0 : p.change_7d;
  return Math.min(ASSERTED.growth_cap, Math.max(ASSERTED.growth_floor, g));
}

/**
 * Least squares with extra columns, solved by the normal equations with Gauss-Jordan
 * elimination: the fitted-coefficient variants of the validation ladder need a small general
 * solver, and this one mirrors the research harness step for step, pivoting included.
 */
function olsMulti(train: SnapshotProtocol[], extra: ('growth' | 'age')[], asOf: string): number[] {
  const X = train.map((p) => {
    const row = [1, Math.log(Math.max(1, p.tvl_usd))];
    for (const col of extra) row.push(col === 'growth' ? clampGrowth(p) / 100 : ageIndexOf(p, asOf));
    return row;
  });
  const y = train.map((p) => Math.log(p.mcap_usd! / p.tvl_usd));
  const n = y.length;
  const k = X[0]!.length;
  const A: number[][] = [];
  for (let i = 0; i < k; i++) {
    const row: number[] = [];
    for (let j = 0; j < k; j++) row.push(X.reduce((s, r) => s + r[i]! * r[j]!, 0));
    row.push(X.reduce((s, r, ri) => s + r[i]! * y[ri]!, 0));
    A.push(row);
  }
  void n;
  for (let c = 0; c < k; c++) {
    let piv = c;
    for (let r = c + 1; r < k; r++) if (Math.abs(A[r]![c]!) > Math.abs(A[piv]![c]!)) piv = r;
    const tmp = A[c]!;
    A[c] = A[piv]!;
    A[piv] = tmp;
    const d = A[c]![c]!;
    if (Math.abs(d) < 1e-12) continue;
    for (let j = 0; j <= k; j++) A[c]![j] = A[c]![j]! / d;
    for (let r = 0; r < k; r++) {
      if (r !== c && A[r]![c]! !== 0) {
        const f = A[r]![c]!;
        for (let j = 0; j <= k; j++) A[r]![j] = A[r]![j]! - f * A[c]![j]!;
      }
    }
  }
  return A.map((row) => row[k]!);
}

/** Every fit the validation ladder needs from one training set. */
interface FitSet {
  size: { intercept: number; slope: number };
  tilt10: Map<string, number>;
  tilt30: Map<string, number>;
  betaG: number[];
  tiltG: Map<string, number>;
  betaGA: number[];
  tiltGA: Map<string, number>;
}

function fitSet(train: SnapshotProtocol[], asOf: string): FitSet {
  const size = ols(train);
  const sizeLM = (p: SnapshotProtocol): number => size.intercept + size.slope * Math.log(Math.max(1, p.tvl_usd));
  const betaG = olsMulti(train, ['growth'], asOf);
  const lmG = (p: SnapshotProtocol): number =>
    betaG[0]! + betaG[1]! * Math.log(Math.max(1, p.tvl_usd)) + betaG[2]! * (clampGrowth(p) / 100);
  const betaGA = olsMulti(train, ['growth', 'age'], asOf);
  const lmGA = (p: SnapshotProtocol): number =>
    betaGA[0]! + betaGA[1]! * Math.log(Math.max(1, p.tvl_usd)) + betaGA[2]! * (clampGrowth(p) / 100) + betaGA[3]! * ageIndexOf(p, asOf);
  return {
    size,
    tilt10: tiltsFrom(train, sizeLM, 10),
    tilt30: tiltsFrom(train, sizeLM, 30),
    betaG,
    tiltG: tiltsFrom(train, lmG, 10),
    betaGA,
    tiltGA: tiltsFrom(train, lmGA, 10),
  };
}

type VariantKey = 'flat' | 'size' | 'tilt' | 'tilt30' | 'sizeGrowth' | 'sizeAge' | 'tiltGrowth' | 'full' | 'fitGrowth' | 'fitAge';

const VARIANT_KEYS: VariantKey[] = ['flat', 'size', 'tilt', 'tilt30', 'sizeGrowth', 'sizeAge', 'tiltGrowth', 'full', 'fitGrowth', 'fitAge'];

/** What every ladder variant predicts for one protocol from one training set's fits. */
function variantPreds(fs: FitSet, p: SnapshotProtocol, asOf: string): Record<VariantKey, number> {
  const tvl = p.tvl_usd;
  const logTvl = Math.log(Math.max(1, tvl));
  const sizePred = tvl * sizeMultiple(fs.size, tvl);
  const tilt = sizePred * (fs.tilt10.get(p.category ?? '') ?? 1);
  const gm = growthMultOf(p);
  const mm = maturityMultOf(p, asOf);
  const fitGrowth =
    tvl * Math.exp(fs.betaG[0]! + fs.betaG[1]! * logTvl + fs.betaG[2]! * (clampGrowth(p) / 100)) * (fs.tiltG.get(p.category ?? '') ?? 1);
  const fitAge =
    tvl *
    Math.exp(fs.betaGA[0]! + fs.betaGA[1]! * logTvl + fs.betaGA[2]! * (clampGrowth(p) / 100) + fs.betaGA[3]! * ageIndexOf(p, asOf)) *
    (fs.tiltGA.get(p.category ?? '') ?? 1);
  return {
    flat: MODEL.base_multiple * tvl,
    size: sizePred,
    tilt,
    tilt30: sizePred * (fs.tilt30.get(p.category ?? '') ?? 1),
    sizeGrowth: sizePred * gm,
    sizeAge: sizePred * mm,
    tiltGrowth: tilt * gm,
    full: tilt * gm * mm,
    fitGrowth,
    fitAge,
  };
}

/** The median of a list of errors, the way a statistics package takes it. */
function medianOf(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/** A P25-P75 band from a training set's residuals of ln(actual / predicted). */
function bandFromResiduals(residuals: number[]): { lo: number; hi: number } {
  const sorted = [...residuals].sort((a, b) => a - b);
  const q = (f: number): number => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(f * sorted.length)))]!;
  return { lo: Math.exp(q(0.25)), hi: Math.exp(q(0.75)) };
}

const VALUE_TERM_META: { key: VariantKey; name: string; kept: boolean; role: ValueTerm['role'] }[] = [
  { key: 'flat', name: 'Flat 0.25x TVL (the house multiple)', kept: false, role: 'reference' },
  { key: 'size', name: 'Size curve alone', kept: true, role: 'model' },
  { key: 'tilt', name: 'Size + category tilt (shrinkage k=10)', kept: false, role: 'tested' },
  { key: 'tilt30', name: 'Size + category tilt, stronger shrinkage (k=30)', kept: false, role: 'tested' },
  { key: 'sizeGrowth', name: 'Size + growth multiplier', kept: false, role: 'tested' },
  { key: 'sizeAge', name: 'Size + maturity multiplier', kept: false, role: 'tested' },
  { key: 'tiltGrowth', name: 'Size + tilt + growth multiplier', kept: false, role: 'tested' },
  { key: 'full', name: 'radar-3 full: tilt + growth + maturity', kept: false, role: 'tested' },
  { key: 'fitGrowth', name: 'Fitted growth coefficient (on the tilt)', kept: false, role: 'tested' },
  { key: 'fitAge', name: 'Fitted growth + age coefficients (on the tilt)', kept: false, role: 'tested' },
];

/**
 * The value ladder under the two designs that punish noise-fitting: leave-one-out over every
 * comp (each fit recomputed without the held-out comp) and walk-forward by listed year (train on
 * earlier years, test on the year, errors pooled). The same pass scores the range honesty of the
 * shipped band and of the two radar-3 bands, so the dashboard's evidence panel is this program's
 * own arithmetic on this snapshot.
 */
function valueValidation(snapshot: Snapshot): { terms: ValueTerm[]; wfRows: number; rangeChecks: RangeCheck[] } {
  const comps = tradedComps(snapshot);
  const asOf = snapshot.as_of;
  const dated = comps.filter((p) => p.listed_at !== null);
  const yearOf = (p: SnapshotProtocol): number => Number(p.listed_at!.slice(0, 4));
  const years = [...new Set(dated.map(yearOf))]
    .filter((Y) => dated.filter((p) => yearOf(p) < Y).length >= 5)
    .sort((a, b) => a - b);
  const looErrs = new Map<VariantKey, number[]>(VARIANT_KEYS.map((k) => [k, []]));
  const wfErrs = new Map<VariantKey, number[]>(VARIANT_KEYS.map((k) => [k, []]));
  let sizeLooIn = 0;
  let fullLooIn = 0;
  let printedLooIn = 0;
  let sizeWfIn = 0;
  let fullWfIn = 0;
  let printedWfIn = 0;
  let wfRows = 0;
  const scoreBands = (
    fs: FitSet,
    train: SnapshotProtocol[],
    p: SnapshotProtocol,
    preds: Record<VariantKey, number>,
    acc: { size: number; full: number; printed: number },
  ): void => {
    const sizeBand = bandFromResiduals(train.map((t) => Math.log(t.mcap_usd! / variantPreds(fs, t, asOf).size)));
    const fullBand = bandFromResiduals(train.map((t) => Math.log(t.mcap_usd! / variantPreds(fs, t, asOf).full)));
    const mcap = p.mcap_usd!;
    if (preds.size * sizeBand.lo <= mcap && mcap <= preds.size * sizeBand.hi) acc.size += 1;
    if (preds.full * fullBand.lo <= mcap && mcap <= preds.full * fullBand.hi) acc.full += 1;
    if (preds.full * sizeBand.lo <= mcap && mcap <= preds.full * sizeBand.hi) acc.printed += 1;
  };
  for (let i = 0; i < comps.length; i++) {
    const p = comps[i]!;
    const train = comps.filter((_, j) => j !== i);
    const fs = fitSet(train, asOf);
    const preds = variantPreds(fs, p, asOf);
    for (const k of VARIANT_KEYS) looErrs.get(k)!.push(Math.abs(Math.log(preds[k] / p.mcap_usd!)));
    const acc = { size: 0, full: 0, printed: 0 };
    scoreBands(fs, train, p, preds, acc);
    sizeLooIn += acc.size;
    fullLooIn += acc.full;
    printedLooIn += acc.printed;
  }
  for (const Y of years) {
    const train = dated.filter((p) => yearOf(p) < Y);
    const test = dated.filter((p) => yearOf(p) === Y);
    const fs = fitSet(train, asOf);
    for (const p of test) {
      const preds = variantPreds(fs, p, asOf);
      for (const k of VARIANT_KEYS) wfErrs.get(k)!.push(Math.abs(Math.log(preds[k] / p.mcap_usd!)));
      const acc = { size: 0, full: 0, printed: 0 };
      scoreBands(fs, train, p, preds, acc);
      sizeWfIn += acc.size;
      fullWfIn += acc.full;
      printedWfIn += acc.printed;
      wfRows += 1;
    }
  }
  const terms = VALUE_TERM_META.map((m) => ({
    name: m.name,
    loo: round3(medianOf(looErrs.get(m.key)!)),
    wf: round3(medianOf(wfErrs.get(m.key)!)),
    kept: m.kept,
    role: m.role,
  }));
  const pct = (inside: number, n: number): number => round1((100 * inside) / Math.max(1, n));
  const rangeChecks: RangeCheck[] = [
    { name: 'Size curve, band from its own residuals (the band this board prints)', loo_pct: pct(sizeLooIn, comps.length), wf_pct: pct(sizeWfIn, wfRows) },
    { name: 'radar-3 full model, band from its own residuals', loo_pct: pct(fullLooIn, comps.length), wf_pct: pct(fullWfIn, wfRows) },
    { name: 'radar-3 as printed: the size band over full-model values', loo_pct: pct(printedLooIn, comps.length), wf_pct: pct(printedWfIn, wfRows) },
  ];
  return { terms, wfRows, rangeChecks };
}

/**
 * A Mersenne-Twister generator seeded exactly the way CPython's random module seeds it, so the
 * odds cross-validation below shuffles the protocols into the same folds the research harness
 * used. Only what the validation needs: 32-bit draws, randbelow and a Fisher-Yates shuffle.
 */
class PythonRandom {
  private mt = new Uint32Array(624);
  private index = 625;

  constructor(seed: number) {
    this.initByArray([seed >>> 0]);
  }

  private initGenrand(s: number): void {
    const mt = this.mt;
    mt[0] = s >>> 0;
    for (let i = 1; i < 624; i++) {
      const prev = mt[i - 1]!;
      mt[i] = (Math.imul(1812433253, prev ^ (prev >>> 30)) + i) >>> 0;
    }
    this.index = 625;
  }

  private initByArray(key: number[]): void {
    this.initGenrand(19650218);
    const mt = this.mt;
    let i = 1;
    let j = 0;
    for (let k = Math.max(624, key.length); k > 0; k--) {
      const prev = mt[i - 1]!;
      mt[i] = ((mt[i]! ^ Math.imul(prev ^ (prev >>> 30), 1664525)) + key[j]! + j) >>> 0;
      i += 1;
      j += 1;
      if (i >= 624) {
        mt[0] = mt[623]!;
        i = 1;
      }
      if (j >= key.length) j = 0;
    }
    for (let k = 623; k > 0; k--) {
      const prev = mt[i - 1]!;
      mt[i] = ((mt[i]! ^ Math.imul(prev ^ (prev >>> 30), 1566083941)) - i) >>> 0;
      i += 1;
      if (i >= 624) {
        mt[0] = mt[623]!;
        i = 1;
      }
    }
    mt[0] = 0x80000000;
  }

  private twist(): void {
    const mt = this.mt;
    for (let kk = 0; kk < 227; kk++) {
      const y = (mt[kk]! & 0x80000000) | (mt[kk + 1]! & 0x7fffffff);
      mt[kk] = (mt[kk + 397]! ^ (y >>> 1) ^ (y & 1 ? 0x9908b0df : 0)) >>> 0;
    }
    for (let kk = 227; kk < 623; kk++) {
      const y = (mt[kk]! & 0x80000000) | (mt[kk + 1]! & 0x7fffffff);
      mt[kk] = (mt[kk - 227]! ^ (y >>> 1) ^ (y & 1 ? 0x9908b0df : 0)) >>> 0;
    }
    const y = (mt[623]! & 0x80000000) | (mt[0]! & 0x7fffffff);
    mt[623] = (mt[396]! ^ (y >>> 1) ^ (y & 1 ? 0x9908b0df : 0)) >>> 0;
    this.index = 0;
  }

  private uint32(): number {
    if (this.index >= 624) this.twist();
    let y = this.mt[this.index]!;
    this.index += 1;
    y ^= y >>> 11;
    y ^= (y << 7) & 0x9d2c5680;
    y ^= (y << 15) & 0xefc60000;
    y ^= y >>> 18;
    return y >>> 0;
  }

  private randbelow(n: number): number {
    const k = n.toString(2).length;
    let r = this.uint32() >>> (32 - k);
    while (r >= n) r = this.uint32() >>> (32 - k);
    return r;
  }

  shuffle(arr: number[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.randbelow(i + 1);
      const t = arr[i]!;
      arr[i] = arr[j]!;
      arr[j] = t;
    }
  }
}

type OddsKey = 'constant' | 'cohort' | 'current' | 'peer';

const ODDS_KEYS: OddsKey[] = ['constant', 'cohort', 'current', 'peer'];

/**
 * The odds designs under both tests: 10-fold cross-validation x5 repeats over every protocol in
 * the snapshot (the folds are CPython's, via the generator above) and walk-forward by listed
 * year. In walk-forward a test year's own cohort cannot exist in the training years, so the
 * cohort-only design degenerates to the constant and the column mostly tests the category and
 * peer signals; the cross-validation tests the whole model.
 */
function oddsValidation(snapshot: Snapshot): { terms: OddsTerm[]; wfRows: number } {
  const protocols = snapshot.protocols;
  const asOf = snapshot.as_of;
  const modelsFor = (train: SnapshotProtocol[]) => {
    const cohorts = cohortRatesOf(train);
    const shares = categorySharesOf(train);
    const peers = peerIndex(train, asOf);
    const glob = train.filter(hasTokenRecord).length / Math.max(1, train.length);
    return {
      constant: glob,
      cohort: (p: SnapshotProtocol): number => {
        const c = cohorts.find((x) => x.cohort === (p.listed_at === null ? 'unknown' : p.listed_at.slice(0, 4)));
        return c !== undefined && c.total >= 10 ? c.tokenized / c.total : glob;
      },
      current: (p: SnapshotProtocol): number => launchOdds(p, cohorts, shares) / 100,
      peer: (p: SnapshotProtocol): number => peerOdds(p, asOf, peers).odds,
    };
  };
  const brier = (acc: [number, number][]): number => acc.reduce((s, [pr, y]) => s + (pr - y) ** 2, 0) / Math.max(1, acc.length);
  const cvBriers: Record<OddsKey, number[]> = { constant: [], cohort: [], current: [], peer: [] };
  for (let rep = 0; rep < 5; rep++) {
    const rng = new PythonRandom(1000 + rep);
    const idx = protocols.map((_, i) => i);
    rng.shuffle(idx);
    const folds: number[][] = Array.from({ length: 10 }, () => []);
    idx.forEach((v, i) => folds[i % 10]!.push(v));
    const acc: Record<OddsKey, [number, number][]> = { constant: [], cohort: [], current: [], peer: [] };
    for (const fold of folds) {
      const inFold = new Set(fold);
      const train = idx.filter((i) => !inFold.has(i)).map((i) => protocols[i]!);
      const models = modelsFor(train);
      for (const i of fold) {
        const p = protocols[i]!;
        const y = hasTokenRecord(p) ? 1 : 0;
        acc.constant.push([models.constant, y]);
        acc.cohort.push([models.cohort(p), y]);
        acc.current.push([models.current(p), y]);
        acc.peer.push([models.peer(p), y]);
      }
    }
    for (const k of ODDS_KEYS) cvBriers[k].push(brier(acc[k]));
  }
  const datedAll = protocols.filter((p) => p.listed_at !== null);
  const years = [...new Set(datedAll.map((p) => Number(p.listed_at!.slice(0, 4))))].sort((a, b) => a - b);
  const wfAcc: Record<OddsKey, [number, number][]> = { constant: [], cohort: [], current: [], peer: [] };
  let wfRows = 0;
  for (const Y of years) {
    const train = datedAll.filter((p) => Number(p.listed_at!.slice(0, 4)) < Y);
    const test = datedAll.filter((p) => Number(p.listed_at!.slice(0, 4)) === Y);
    if (train.length < 30 || test.length === 0) continue;
    const models = modelsFor(train);
    for (const p of test) {
      const y = hasTokenRecord(p) ? 1 : 0;
      wfAcc.constant.push([models.constant, y]);
      wfAcc.cohort.push([models.cohort(p), y]);
      wfAcc.current.push([models.current(p), y]);
      wfAcc.peer.push([models.peer(p), y]);
      wfRows += 1;
    }
  }
  const mean = (v: number[]): number => v.reduce((s, x) => s + x, 0) / Math.max(1, v.length);
  const meta: { key: OddsKey; name: string; kept: boolean; role: OddsTerm['role'] }[] = [
    { key: 'constant', name: 'One flat rate for everyone', kept: false, role: 'reference' },
    { key: 'cohort', name: 'Listed-year cohort only', kept: false, role: 'tested' },
    { key: 'current', name: 'Cohort x category (this board\u2019s odds)', kept: true, role: 'model' },
    { key: 'peer', name: 'Peer groups: category x TVL band x age band', kept: false, role: 'tested' },
  ];
  const terms = meta.map((m) => ({ name: m.name, cv: round4(mean(cvBriers[m.key])), wf: round4(brier(wfAcc[m.key])), kept: m.kept, role: m.role }));
  return { terms, wfRows };
}

/** The protocol ledger: every protocol in exactly one group, plus the screen's rejects by rule. */
function accounting(snapshot: Snapshot, board: BoardRow[]): RadarData['accounting'] {
  const boardSlugs = new Set(board.map((r) => r.slug));
  const assigned = new Set<string>();
  const take = (pred: (p: SnapshotProtocol) => boolean): number => {
    let n = 0;
    for (const p of snapshot.protocols) {
      if (!assigned.has(p.slug) && pred(p)) {
        assigned.add(p.slug);
        n += 1;
      }
    }
    return n;
  };
  const groups: AccountingGroup[] = [
    { label: 'Ranked on the pre-token board', count: take((p) => boardSlugs.has(p.slug)) },
    { label: 'Screened out by the integrity screen', count: take((p) => isPreToken(p) && screenReason(p) !== null) },
    { label: 'Already trade: the comps the model learns from', count: take((p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0) },
    { label: 'Record a token another way (a parent\u2019s symbol, an unusable cap)', count: take((p) => hasTokenRecord(p)) },
  ];
  const belowCut = take((p) => isPreToken(p));
  if (belowCut > 0) groups.push({ label: 'Pre-token, below the board\u2019s cut', count: belowCut });
  const rest = take(() => true);
  if (rest > 0) groups.push({ label: 'Dead records: a zero cap and no token identifiers', count: rest });
  const reasonCounts = new Map<string, number>();
  for (const p of snapshot.protocols) {
    if (isPreToken(p) && screenReason(p) !== null && !boardSlugs.has(p.slug)) {
      const k = screenKind(p);
      reasonCounts.set(k, (reasonCounts.get(k) ?? 0) + 1);
    }
  }
  const screened_reasons = [...reasonCounts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || (a.label < b.label ? -1 : 1));
  return { total: snapshot.protocols.length, groups, screened_reasons };
}

/** A board row's compact form for data.js, with the farm plan generated in the page. */
export function radarRow(
  row: BoardRow,
  snapshot: Snapshot,
  fit: Fit,
  cohorts: CohortRate[],
  shares: Map<string, { share: number; n: number }>,
  peers: PeerIndex,
): RadarRow {
  const p = snapshot.protocols.find((x) => x.slug === row.slug)!;
  const peer = peerOdds(p, snapshot.as_of, peers);
  const farm = farmEconomics(p, row.age_days, peer.odds, row.implied_value_usd);
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    implied_low_usd: Math.max(1, Math.round(row.implied_value_usd * fit.bandLow)),
    implied_high_usd: Math.round(row.implied_value_usd * fit.bandHigh),
    base_multiple: row.model.base_multiple,
    launch_odds_pct: launchOdds(p, cohorts, shares),
    ev_usd: row.ev,
    peer_odds_pct: round1(peer.odds * 100),
    peer_cell: peer.cell,
    peer_cell_n: peer.cellN,
    farm_verdict: farm.verdict,
    farm_net_usd: round2(farm.net),
    farm_per_hour_usd: round2(farm.perHour),
    farm_fees_usd: round2(farm.fees),
    farm_ev_usd: round2(farm.evFarm),
    farm_hours: round2(farm.hours),
    on_watchlist: snapshot.watchlist.includes(row.slug),
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const fit = fitModel(snapshot);
  const cohorts = cohortRates(snapshot);
  const shares = categoryShares(snapshot);
  const peers = peerIndex(snapshot.protocols, snapshot.as_of);
  const value = valueValidation(snapshot);
  const odds = oddsValidation(snapshot);
  const screened = screenedOut(snapshot);
  const screenedTotal = snapshot.protocols.filter((p) => isPreToken(p) && screenReason(p) !== null).length;
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const geoMean = Math.exp(
    tradedComps(snapshot).reduce((s, p) => s + Math.log(p.mcap_usd! / p.tvl_usd), 0) / Math.max(1, fit.comps),
  );
  const counts: Record<FarmVerdictLabel, number> = { FARM: 0, MARGINAL: 0, SKIP: 0 };
  for (const r of board) counts[r.farmVerdict] += 1;
  const bestRow = board.reduce((a, b) => (b.farmPerHour > a.farmPerHour ? b : a), board[0]!);
  const bySlugMap = bySlug(snapshot.protocols);
  const sensitivity = [0.02, 0.1].map((ds) => {
    const c: Record<FarmVerdictLabel, number> = { FARM: 0, MARGINAL: 0, SKIP: 0 };
    for (const r of board) {
      const p = bySlugMap.get(r.slug)!;
      const peer = peerOdds(p, snapshot.as_of, peers);
      c[farmEconomics(p, r.age_days, peer.odds, r.implied_value_usd, ds, model).verdict] += 1;
    }
    return { drop_share: ds, counts: c };
  });
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    total_protocols: snapshot.protocols.length,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    rows: board.map((r) => radarRow(r, snapshot, fit, cohorts, shares, peers)),
    live,
    fit: {
      comps: fit.comps,
      ols_intercept: round3(fit.intercept),
      ols_slope: round3(fit.slope),
      geo_mean_multiple: round3(geoMean),
      band_low_factor: round3(fit.bandLow),
      band_high_factor: round3(fit.bandHigh),
    },
    validation: {
      comps: fit.comps,
      wf_rows: value.wfRows,
      odds_wf_rows: odds.wfRows,
      value_terms: value.terms,
      range_checks: value.rangeChecks,
      odds_terms: odds.terms,
    },
    farm: {
      ticket_usd: model.ticket_usd,
      drop_share: model.drop_share,
      counts,
      best: { name: bestRow.name, net_per_hour_usd: bestRow.farmPerHour },
      sensitivity,
    },
    accounting: accounting(snapshot, board),
    totals: {
      implied_sum: board.reduce((s, r) => s + r.implied_value_usd, 0),
      ev_sum: board.reduce((s, r) => s + r.ev, 0),
    },
    cohorts,
    screened_out: screened,
    screened_out_count: screenedTotal,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, expected-value order, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.ev > board[i - 1]!.ev) return `row ${i + 1} outranks row ${i} on expected value`;
  if (board.length >= 2 && board[0]!.ev === board[board.length - 1]!.ev) {
    return `all ${board.length} rows share the same expected value $${board[0]!.ev}: a board that ranks nothing is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
    if (!Number.isSafeInteger(r.ev) || r.ev <= 0) return `${r.slug} has expected value ${r.ev}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
