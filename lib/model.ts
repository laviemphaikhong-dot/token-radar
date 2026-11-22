// The token radar's model: one snapshot of the protocol universe in, one ranked board out.
//
// The board covers every slug in the snapshot's watchlist (the floor, never a ceiling) and adds the
// strongest pre-token protocols the integrity screen passes, wherever they sit against the floor.
// A protocol is pre-token when its record carries no token (no market cap, no CoinGecko id, no
// symbol); the snapshot's live-token protocols are kept apart and shown at the market's own values.
//
// The implied value is fitted from the snapshot's own traded tokens, never asserted:
//
//   comps       = the protocols that record a token with mcap_usd > 0 and tvl_usd > 0 (128 here)
//   size fit    = OLS of ln(mcap / tvl) on ln(tvl) over the comps: bigger protocols trade at lower
//                 multiples (slope about -0.49), so the multiple is a curve, not a constant
//   tilt        = each category's geometric-mean residual against the size fit, shrunk toward 1
//                 by n / (n + 10) and capped to [0.7, 1.43]: category evidence is thin, so it may
//                 bend the curve but never replace it
//   growth      = clamp(change_7d, -60, 120) per cent; multiplier 1 + (growth / 100) x 0.5
//   maturity    = 0.6 + min(age_days, 1095) / 1095 x 0.4   (age_days unknown: 365)
//   implied     = max(1, round(tvl x fitted multiple x tilt x growth x maturity))
//
// The fit is validated, not just stated: the comps are shuffled into two halves 200 times with a
// seeded generator (so every run scores the same splits), the FULL board pipeline — size curve,
// category tilt, growth and maturity multipliers, exactly as a board row is computed — is fitted
// on one half and scored on the other, and the dashboard publishes the mean held-out median log
// error next to the house model's flat 0.25x and the size curve alone on the same splits. The
// launch odds are checked the same way, by Brier score against cohort alone and one flat rate.
// Alternatives were tested on the same splits and left out because none beat this model beyond
// noise: winsorising the comps, a robust Theil–Sen fit, a chain-count term, a quadratic size
// term, retuned growth/maturity constants, and a TVL band in the odds. The board also carries
// an implied range: the interquartile band of the fit's residuals, so a reader sees how wide the
// honest uncertainty is instead of a false point.
//
// Launch odds are an empirical base rate, not a prediction: of the protocols DefiLlama has tracked
// since a given year, the share that already record a token under the snapshot's own definition (a
// CoinGecko id, a symbol, or a market cap: 80% for the 2021 cohort, 31% for 2026), adjusted by the
// protocol's category share shrunk the same way and clamped to [2%, 85%]. It says how often
// protocols like this one have launched by now, with the survivorship caveat the dashboard prints
// beside it: a protocol still tokenless years on is, if anything, a slower launcher than its
// cohort's share suggests.
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

/** The model's constants, as the dashboard states them and the sandbox may change them. */
export interface ModelConstants {
  base_multiple: number;
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
}

export const MODEL: ModelConstants = {
  base_multiple: 0.25,
  growth_weight: 0.5,
  growth_floor: -60,
  growth_cap: 120,
  maturity_floor: 0.6,
  maturity_range: 0.4,
  maturity_days: 1095,
  unknown_age_days: 365,
};

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-3';

/** How many pre-token protocols beyond the watchlist the early radar carries, by implied value. */
export const EARLY_ROWS = 160;

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

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
  model: {
    base_multiple: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
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
  growth_multiplier: number;
  maturity_multiplier: number;
  launch_odds_pct: number;
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

/** The fitted model's evidence, as the dashboard's method section states it. */
export interface FitSummary {
  comps: number;
  ols_intercept: number;
  ols_slope: number;
  geo_mean_multiple: number;
  band_low_factor: number;
  band_high_factor: number;
  heldout_flat_median_log_err: number;
  heldout_size_median_log_err: number;
  heldout_model_median_log_err: number;
  heldout_rows: number;
  heldout_splits: number;
}

/** The launch odds' held-out check: Brier scores over the same seeded splits, lower is better. */
export interface OddsCheck {
  brier_model: number;
  brier_cohort_only: number;
  brier_constant: number;
  splits: number;
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
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
  fit: FitSummary;
  odds_check: OddsCheck;
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

/** The protocols that can teach the model what a token trades at: a token, a market cap, a TVL. */
export function tradedComps(snapshot: Snapshot): SnapshotProtocol[] {
  return snapshot.protocols.filter((p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0);
}

/** A fitted valuation: the size curve, the shrunk category tilts, and the residual band. */
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
  const xs = comps.map((p) => Math.log(p.tvl_usd));
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
function sizeMultiple(fit: { intercept: number; slope: number }, tvl: number): number {
  return Math.exp(fit.intercept + fit.slope * Math.log(Math.max(1, tvl)));
}

/**
 * Fit the valuation on the snapshot's traded comps: the size curve, each category's shrunk tilt
 * (its geometric-mean residual against the curve, pulled toward 1 by n / (n + 10) and capped),
 * and the residual interquartile band a board range is drawn from.
 */
export function fitModel(snapshot: Snapshot): Fit {
  const comps = tradedComps(snapshot);
  const { intercept, slope } = ols(comps);
  const base = { intercept, slope };
  const residuals = comps.map((p) => Math.log(p.mcap_usd! / p.tvl_usd) - Math.log(sizeMultiple(base, p.tvl_usd)));
  const byCategory = new Map<string, number[]>();
  comps.forEach((p, i) => {
    const key = p.category ?? '';
    const list = byCategory.get(key) ?? [];
    list.push(residuals[i]!);
    byCategory.set(key, list);
  });
  const tilts = new Map<string, number>();
  for (const [category, list] of byCategory) {
    const mean = list.reduce((s, x) => s + x, 0) / list.length;
    const w = list.length / (list.length + 10);
    tilts.set(category, Math.min(1.43, Math.max(0.7, Math.exp(w * mean))));
  }
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

/** The fitted multiple one protocol gets before growth and maturity: size curve times category tilt. */
export function fittedMultiple(fit: Fit, p: SnapshotProtocol): number {
  return sizeMultiple(fit, p.tvl_usd) * (fit.tilts.get(p.category ?? '') ?? 1);
}

/** A tiny seeded generator (mulberry32): the validation splits are the same on every run. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A shuffled copy of `rows`, split in halves: the split every validation below shares. */
function splitHalf<T>(rows: T[], rand: () => number): { train: T[]; test: T[] } {
  const shuffled = [...rows];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = shuffled[i]!;
    shuffled[i] = shuffled[j]!;
    shuffled[j] = tmp;
  }
  const half = Math.floor(shuffled.length / 2);
  return { train: shuffled.slice(0, half), test: shuffled.slice(half) };
}

const VALIDATION_SPLITS = 200;
const VALIDATION_SEED = 20261114;

/**
 * The held-out evidence, computed the same way every run: 200 seeded splits of the comps, the
 * full board pipeline fitted on one half and scored on the other, against the flat 0.25x and
 * the size curve alone on the same rows. Each figure is the mean of the splits' median
 * absolute log errors, so no single lucky split carries the claim.
 */
export function validation(snapshot: Snapshot): { flat: number; size: number; model: number; rows: number; splits: number } {
  const comps = [...tradedComps(snapshot)].sort((a, b) => (a.slug < b.slug ? -1 : 1));
  const rand = mulberry32(VALIDATION_SEED);
  const median = (v: number[]): number => v[Math.floor(v.length / 2)]!;
  let flat = 0;
  let size = 0;
  let model = 0;
  let rows = 0;
  for (let s = 0; s < VALIDATION_SPLITS; s++) {
    const { train, test } = splitHalf(comps, rand);
    const fit = fitModel({ ...snapshot, protocols: train });
    const errs = (pick: (p: SnapshotProtocol) => number): number[] =>
      test.map((p) => Math.abs(Math.log(pick(p) / p.mcap_usd!))).sort((a, b) => a - b);
    flat += median(errs((p) => 0.25 * p.tvl_usd));
    size += median(errs((p) => sizeMultiple(fit, p.tvl_usd) * p.tvl_usd));
    model += median(errs((p) => impliedValue(p, snapshot.as_of, MODEL, fit).implied));
    rows = test.length;
  }
  return {
    flat: round3(flat / VALIDATION_SPLITS),
    size: round3(size / VALIDATION_SPLITS),
    model: round3(model / VALIDATION_SPLITS),
    rows,
    splits: VALIDATION_SPLITS,
  };
}

/**
 * The launch odds' own held-out check, on seeded splits over every protocol: the model's
 * Brier score for "already records a token", against the cohort rate alone and one flat rate
 * for everyone. The odds are a cross-section base rate, and this is the honest measure of
 * how much the category adjustment earns.
 */
export function oddsCheck(snapshot: Snapshot): OddsCheck {
  const rand = mulberry32(VALIDATION_SEED + 1);
  let model = 0;
  let cohortOnly = 0;
  let constant = 0;
  for (let s = 0; s < VALIDATION_SPLITS; s++) {
    const { train, test } = splitHalf(snapshot.protocols, rand);
    const sub: Snapshot = { ...snapshot, protocols: train };
    const cohorts = cohortRates(sub);
    const shares = categoryShares(sub);
    const overall = train.filter(hasTokenRecord).length / Math.max(1, train.length);
    let m = 0;
    let c = 0;
    let k = 0;
    for (const p of test) {
      const y = hasTokenRecord(p) ? 1 : 0;
      const mp = launchOdds(p, cohorts, shares) / 100;
      const cohort = p.listed_at === null ? 'unknown' : p.listed_at.slice(0, 4);
      const cell = cohorts.find((x) => x.cohort === cohort);
      const cp = cell !== undefined && cell.total >= 10 ? cell.share_pct / 100 : overall;
      m += (mp - y) ** 2;
      c += (cp - y) ** 2;
      k += (overall - y) ** 2;
    }
    model += m / test.length;
    cohortOnly += c / test.length;
    constant += k / test.length;
  }
  return {
    brier_model: round4(model / VALIDATION_SPLITS),
    brier_cohort_only: round4(cohortOnly / VALIDATION_SPLITS),
    brier_constant: round4(constant / VALIDATION_SPLITS),
    splits: VALIDATION_SPLITS,
  };
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

/** The listed-year cohorts and the share of each that already records a token. */
export function cohortRates(snapshot: Snapshot): CohortRate[] {
  const byYear = new Map<string, { tokenized: number; total: number }>();
  for (const p of snapshot.protocols) {
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

/** Each category's tokenized share over the whole snapshot, for the odds adjustment. */
function categoryShares(snapshot: Snapshot): Map<string, { share: number; n: number }> {
  const byCategory = new Map<string, { tokenized: number; total: number }>();
  let tok = 0;
  for (const p of snapshot.protocols) {
    const key = p.category ?? '';
    const cell = byCategory.get(key) ?? { tokenized: 0, total: 0 };
    cell.total += 1;
    if (hasTokenRecord(p)) {
      cell.tokenized += 1;
      tok += 1;
    }
    byCategory.set(key, cell);
  }
  const overall = tok / snapshot.protocols.length;
  const out = new Map<string, { share: number; n: number }>();
  for (const [key, cell] of byCategory) out.set(key, { share: (cell.tokenized / cell.total) / overall, n: cell.total });
  return out;
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

/** The three multipliers, the fitted multiple and the implied value one protocol gets. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  model: ModelConstants,
  fit?: Fit,
): { implied: number; multiple: number; growthPct: number; growthMult: number; maturityMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const multiple = fit !== undefined ? fittedMultiple(fit, protocol) : model.base_multiple;
  // The board publishes each factor rounded to 4 decimals, and the implied value is computed from
  // those published factors, so the dashboard's own recomputation of a row lands on the same
  // number board.json carries, to the dollar.
  const implied = Math.max(1, Math.round(protocol.tvl_usd * round4(multiple) * round4(growthMult) * round4(maturityMult)));
  return { implied, multiple, growthPct, growthMult, maturityMult, age };
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

/** Whether a protocol is one the board may rank: pre-token and through the integrity screen. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && screenReason(p) === null;
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The headline sentence's figures: how many watchlist slugs, how many rows, how many live protocols. */
export interface BoardSummary {
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const fit = fitModel(snapshot);
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the snapshot no longer carries (it cannot, but the
  // board's coverage is the gate's row and is never gambled on a missing record or a screen).
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every screened pre-token protocol off the watchlist, scored by the same fitted
  // model, the strongest EARLY_ROWS of them carried. Selection by implied value, not raw TVL: a
  // smaller protocol the comps price richly outranks a larger one they price thinly.
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p))
    .map((p) => ({ p, implied: impliedValue(p, snapshot.as_of, model, fit).implied }))
    .sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0))
    .slice(0, EARLY_ROWS);
  for (const e of early) chosen.set(e.p.slug, e.p);

  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, model, fit);
    return { p, ...v };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
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
    model: {
      base_multiple: round4(s.multiple),
      growth_pct: s.growthPct,
      growth_multiplier: round4(s.growthMult),
      maturity_multiplier: round4(s.maturityMult),
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

/** A board row's compact form for data.js, with the farm plan generated in the page. */
export function radarRow(row: BoardRow, snapshot: Snapshot, fit: Fit, cohorts: CohortRate[], shares: Map<string, { share: number; n: number }>): RadarRow {
  const p = snapshot.protocols.find((x) => x.slug === row.slug)!;
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
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    launch_odds_pct: launchOdds(p, cohorts, shares),
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
  const held = validation(snapshot);
  const odds = oddsCheck(snapshot);
  const screened = screenedOut(snapshot);
  const screenedTotal = snapshot.protocols.filter((p) => isPreToken(p) && screenReason(p) !== null).length;
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const geoMean = Math.exp(
    tradedComps(snapshot).reduce((s, p) => s + Math.log(p.mcap_usd! / p.tvl_usd), 0) / Math.max(1, fit.comps),
  );
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    rows: board.map((r) => radarRow(r, snapshot, fit, cohorts, shares)),
    live,
    fit: {
      comps: fit.comps,
      ols_intercept: round3(fit.intercept),
      ols_slope: round3(fit.slope),
      geo_mean_multiple: round3(geoMean),
      band_low_factor: round3(fit.bandLow),
      band_high_factor: round3(fit.bandHigh),
      heldout_flat_median_log_err: held.flat,
      heldout_size_median_log_err: held.size,
      heldout_model_median_log_err: held.model,
      heldout_rows: held.rows,
      heldout_splits: held.splits,
    },
    odds_check: odds,
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

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
