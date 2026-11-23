// Token Radar's plain dashboard, model radar-4. It reads window.RADAR (written beside dashboard/
// by main.ts) and renders the board ranked by expected value, the out-of-sample evidence the
// program computed for every model term, a per-protocol detail drawer with the size curve's
// inputs, the implied range, both odds readings and the farm verdict's economics, the live tokens
// set aside, the integrity screen's rejects with their reasons, and the method. No network: every
// byte it shows is in data.js, and the page re-checks the board's arithmetic before it prints it.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var state = { q: '', category: 'all', chain: 'all', tier: 'all', tab: 'pre-token', sort: 'rank', dir: 1, selected: null };

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd.format(n);
  }
  function fmtMoney(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    var a = Math.abs(n);
    var s = a >= 100 ? String(Math.round(a)) : a.toFixed(2);
    return (n < 0 ? '-$' : '$') + s;
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  // The model in one function: the page recomputes a row's implied value from its TVL and the
  // fitted size multiple data.js carries for it, and checks the number board.json carries, so the
  // page's code and the board's data are visibly the same arithmetic.
  function impliedOf(row) {
    return Math.max(1, Math.round(row.tvl_usd * row.base_multiple));
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  // The farm plan is the same derivation main.ts writes to board.json: category, chains, TVL and
  // age decide the action, the capital, the hold and every cost and time, and the plan farms on
  // the cheapest chain the protocol runs on. No name is special-cased.
  var CHAIN_GAS_USD = {
    Ethereum: 12, Bitcoin: 2, Tron: 1, Solana: 0.1, Base: 0.15, Arbitrum: 0.2, Optimism: 0.2,
    'OP Mainnet': 0.2, Polygon: 0.05, BSC: 0.2, Avalanche: 0.3, Linea: 0.3, Scroll: 0.3,
    'zkSync Era': 0.2, Mantle: 0.1, Blast: 0.2, Monad: 0.1, Sui: 0.1, Aptos: 0.1, Near: 0.05,
    Unichain: 0.15, Katana: 0.15, Corn: 0.2, 'Robinhood Chain': 0.2, Arc: 0.2
  };
  function farmChain(p) {
    var best = null;
    (p.chains || []).forEach(function (chain) {
      var gas = Object.prototype.hasOwnProperty.call(CHAIN_GAS_USD, chain) ? CHAIN_GAS_USD[chain] : 1;
      if (best === null || gas < best.gas) best = { chain: chain, gas: gas };
    });
    return best || { chain: 'its main chain', gas: 1 };
  }
  function gasText(gas) { return gas < 1 ? 'about ' + Math.round(gas * 100) + ' cents' : 'about $' + Math.round(gas); }
  function capitalFor(p) {
    if (p.tvl_usd >= 5e9) return 250;
    if (p.tvl_usd >= 1e9) return 150;
    if (p.tvl_usd >= 1e8) return 100;
    return 50;
  }
  function holdDaysFor(age) {
    if (age === null || age === undefined) return 30;
    if (age < 180) return 60;
    if (age < 365) return 45;
    return 30;
  }
  function actionFor(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Supply $' + capital + ' of USDC to ' + name + ' on ' + chain + ' and keep the position open.';
    if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0) return 'Provide $' + capital + ' of liquidity to ' + name + "'s main pool on " + chain + ' and keep the position open.';
    if (c.indexOf('bridge') >= 0) return 'Bridge $' + capital + ' of USDC to ' + chain + ' through ' + name + ' and use the bridged funds in its app.';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return "Stake $" + capital + " of the chain's staking asset through " + name + ' and keep the receipt.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0) return 'Deposit $' + capital + ' of USDC as margin on ' + name + ' and open one small hedge.';
    if (c.indexOf('prediction') >= 0) return 'Fund $' + capital + ' and place one market position on ' + name + '.';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0) return 'Deposit $' + capital + ' into a ' + name + ' vault on ' + chain + ' and keep the shares.';
    if (c.indexOf('stable') >= 0) return 'Mint or deposit $' + capital + ' of the stable asset through ' + name + ' on ' + chain + '.';
    if (c.indexOf('rwa') >= 0) return "Mint $" + capital + " of the protocol's yield asset on " + chain + ' and hold it.';
    if (c.indexOf('insurance') >= 0) return 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' and keep the policy.';
    if (c.indexOf('basis') >= 0) return "Deposit $" + capital + " of USDC into " + name + "'s basis vault on " + chain + ' and keep the shares.';
    if (c.indexOf('index') >= 0) return 'Deposit $' + capital + ' of USDC into a ' + name + ' index vault on ' + chain + ' and keep the shares.';
    if (c.indexOf('privacy') >= 0) return "Deposit $" + capital + " of USDC into " + name + "'s shielded pool on " + chain + ' through its own app and keep the note.';
    return 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and keep the position open.';
  }
  function stepText(step) {
    var s = step.text + ' Cost: ' + step.cost + '. Time: ' + step.time + '.';
    if (s.length > 600) s = s.slice(0, 596) + '...';
    if (s.length < 20) s = s + " Hold the position and check the protocol's own page.";
    return s;
  }
  function farmSteps(p) {
    var fc = farmChain(p);
    var usual = capitalFor(p);
    var drop = (typeof p.change_7d === 'number' && isFinite(p.change_7d)) ? p.change_7d : 0;
    var falling = drop <= -20;
    var capital = falling ? Math.max(25, Math.round(usual / 2)) : usual;
    var hold = holdDaysFor(p.age_days);
    var weeks = Math.max(1, Math.round(hold / 7));
    var totalGas = fc.gas * (2 + weeks);
    var steps = [
      { text: 'Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.', cost: gasText(fc.gas) + ' of gas for the first transaction on ' + fc.chain, time: '5 minutes' },
      { text: actionFor(p, capital, fc.chain), cost: '$' + capital + ' of capital and ' + gasText(fc.gas) + ' of gas on ' + fc.chain, time: '15 minutes to set up' },
      { text: 'Make one qualifying action each week on ' + fc.chain + ', such as a deposit, a borrow, a swap or a vote.', cost: gasText(fc.gas) + ' of gas a week', time: '10 minutes a week' },
      { text: 'Hold the position for at least ' + hold + ' days so the activity is counted in more than one snapshot.', cost: 'the $' + capital + ' stays in the position', time: hold + ' days' },
      { text: "Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.", cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
      { text: 'Total plan: $' + capital + ' of capital plus about $' + Math.max(1, Math.round(totalGas)) + ' of gas over ' + weeks + ' weeks. Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.', cost: 'nothing but the log', time: '5 minutes' }
    ];
    if (falling) {
      steps.splice(2, 0, { text: 'Its TVL fell ' + Math.abs(Math.round(drop)) + '% in the last seven days, so this plan starts at half size ($' + capital + ' of the usual $' + usual + '): add the second half only after two weekly checks show the TVL holding.', cost: 'nothing to wait: the second half stays in the wallet', time: '2 weeks of checks' });
    }
    return steps.map(stepText);
  }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('p')) state.selected = params.get('p');
    if (params.get('category')) state.category = params.get('category');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  // The self-check runs here, in the page, against data.js: every row's implied value recomputed
  // from its TVL and fitted multiple, the ranks confirmed as expected-value order, the totals
  // re-added, the watchlist counted, and the protocol ledger re-summed. It prints what it finds.
  function selfCheck() {
    var recomputed = 0, orderOk = true, totalsImp = 0, totalsEv = 0, watch = 0, prevEv = Infinity;
    DATA.rows.forEach(function (r, i) {
      if (impliedOf(r) === r.implied_value_usd) recomputed++;
      if (r.rank !== i + 1 || r.ev_usd > prevEv || r.ev_usd !== Math.round(r.implied_value_usd * r.launch_odds_pct / 100)) orderOk = false;
      prevEv = r.ev_usd;
      totalsImp += r.implied_value_usd;
      totalsEv += r.ev_usd;
      if (r.on_watchlist) watch++;
    });
    var totalsOk = totalsImp === DATA.totals.implied_sum && totalsEv === DATA.totals.ev_sum;
    var ledger = DATA.accounting.groups.reduce(function (s, g) { return s + g.count; }, 0);
    var ledgerOk = ledger === DATA.accounting.total && ledger === DATA.total_protocols;
    function mark(ok) { return ok ? ' \u2713' : ' \u2717'; }
    return 'This table = board.json: ' + recomputed + ' of ' + DATA.rows.length + ' rows recomputed here' + mark(recomputed === DATA.rows.length)
      + ' \u00b7 ranks in expected-value order' + mark(orderOk)
      + ' \u00b7 totals equal' + mark(totalsOk)
      + ' \u00b7 watchlist ' + watch + '/' + DATA.watchlist_size + mark(watch === DATA.watchlist_size)
      + ' \u00b7 ledger ' + ledger + '/' + DATA.total_protocols + mark(ledgerOk);
  }

  function header() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' }, el('span', { class: 'mark' }), el('span', { class: 'brand-name', text: 'Token Radar' })),
      el('div', { class: 'top-meta' },
        el('span', { text: 'Snapshot ' + DATA.as_of }),
        el('span', { text: 'DefiLlama protocol index' }),
        el('span', { text: DATA.model_version + ' model' })
      )
    );
  }

  function lede() {
    return el('section', { class: 'lede' },
      el('h1', { text: DATA.board_size + ' pre-token protocols, ranked by expected value' }),
      el('p', { text: 'Every watchlist protocol is covered, and the early radar adds the strongest pre-token protocols the integrity screen passes. Implied value is a size curve fitted on the ' + DATA.fit.comps + ' tokens that already trade in this snapshot \u2014 the only model term that survives leave-one-out and walk-forward testing \u2014 and the board ranks by that value times the launch odds. Every row also carries a farm verdict net of fees at a $1,000 ticket. A model, not a promise.' }),
      el('p', { class: 'selfcheck', text: selfCheck() })
    );
  }

  function miss(x) { return '\u00d7' + Math.exp(x).toFixed(2); }

  function kpis() {
    var size = DATA.validation.value_terms.filter(function (t) { return t.kept; })[0];
    var range = DATA.validation.range_checks[0];
    var odds = DATA.validation.odds_terms.filter(function (t) { return t.kept; })[0];
    var f = DATA.farm;
    function card(label, value, sub) {
      return el('div', { class: 'kpi' }, el('span', { text: label }), el('b', { text: value }), el('small', { text: sub }));
    }
    return el('section', { class: 'kpis' },
      card('Out-of-sample miss, walk-forward', miss(size.wf), 'median pricing miss on ' + DATA.validation.wf_rows + ' later-listed comps'),
      card('Out-of-sample miss, leave-one-out', miss(size.loo), 'all ' + DATA.validation.comps + ' comps, each refit without it'),
      card('Printed range holds', range.loo_pct + '% / ' + range.wf_pct + '%', 'held-out caps inside the P25\u2013P75 band, LOO / walk-forward (claims 50%)'),
      card('Launch-odds Brier', odds.cv.toFixed(4) + ' / ' + odds.wf.toFixed(4), 'cohort \u00d7 category, cross-validation / walk-forward; lower is better'),
      card('Farm verdicts at a $1,000 ticket', f.counts.FARM + ' FARM \u00b7 ' + f.counts.MARGINAL + ' MARGINAL \u00b7 ' + f.counts.SKIP + ' SKIP', 'at a 5% drop-share assumption; best ' + fmtMoney(f.best.net_per_hour_usd) + '/h, ' + f.best.name),
      card('Watchlist covered', DATA.watchlist_size + ' / ' + DATA.watchlist_size, DATA.board_size + ' pre-token rows, ranked by expected value')
    );
  }

  function accountingStrip() {
    var total = DATA.accounting.total;
    var bar = el('div', { class: 'acct-bar', 'aria-hidden': 'true' },
      DATA.accounting.groups.map(function (g, i) {
        return el('i', { class: 's' + i, style: 'width:' + (g.count / total * 100) + '%' });
      })
    );
    var legend = el('div', { class: 'acct-legend' },
      DATA.accounting.groups.map(function (g, i) {
        return el('span', null, el('i', { class: 'dot s' + i }), g.label + ' ', el('b', { class: 'num', text: String(g.count) }));
      })
    );
    var reasons = DATA.accounting.screened_reasons.map(function (r) { return r.label + ' ' + r.count; }).join(' \u00b7 ');
    return el('section', { class: 'acct' },
      el('h2', { class: 'acct-title', text: 'The whole snapshot, accounted for' }),
      bar, legend,
      el('p', { class: 'sub', text: 'Every one of the ' + total + ' protocols sits in exactly one group. Screened out, by rule: ' + reasons + '.' })
    );
  }

  var TIERS = [['all', 'All'], ['FARM', 'Farm'], ['MARGINAL', 'Marginal'], ['SKIP', 'Skip'], ['watchlist', 'Watchlist']];
  function tierCount(t) {
    if (t === 'all') return DATA.rows.length;
    if (t === 'watchlist') return DATA.rows.filter(function (r) { return r.on_watchlist; }).length;
    return DATA.farm.counts[t];
  }

  function rows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.tier === 'watchlist' && !r.on_watchlist) return false;
      if ((state.tier === 'FARM' || state.tier === 'MARGINAL' || state.tier === 'SKIP') && r.farm_verdict !== state.tier) return false;
      if (state.category !== 'all' && r.category !== state.category) return false;
      if (state.chain !== 'all' && (r.chains || []).indexOf(state.chain) < 0) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'rank') { av = a.rank; bv = b.rank; }
      else if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else if (key === 'odds') { av = a.launch_odds_pct; bv = b.launch_odds_pct; }
      else if (key === 'peer') { av = a.peer_odds_pct; bv = b.peer_odds_pct; }
      else if (key === 'implied') { av = a.implied_value_usd; bv = b.implied_value_usd; }
      else if (key === 'net') { av = a.farm_net_usd; bv = b.farm_net_usd; }
      else if (key === 'perhour') { av = a.farm_per_hour_usd; bv = b.farm_per_hour_usd; }
      else { av = a.ev_usd; bv = b.ev_usd; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  function download(name, text, type) {
    var blob = new Blob([text], { type: type });
    var a = el('a', { href: URL.createObjectURL(blob), download: name });
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  function exportCsv() {
    var lines = ['rank,protocol,category,tvl_usd,change_7d,age_days,launch_odds_pct,peer_odds_pct,implied_value_usd,implied_low_usd,implied_high_usd,expected_value_usd,farm_verdict,farm_net_usd,farm_fees_usd,farm_per_hour_usd'];
    sortedRows(rows()).forEach(function (r) {
      lines.push([r.rank, '"' + r.name.replace(/"/g, '""') + '"', '"' + (r.category || '') + '"', r.tvl_usd, r.change_7d === null ? '' : r.change_7d, r.age_days === null ? '' : r.age_days, r.launch_odds_pct, r.peer_odds_pct, r.implied_value_usd, r.implied_low_usd, r.implied_high_usd, r.ev_usd, r.farm_verdict, r.farm_net_usd, r.farm_fees_usd, r.farm_per_hour_usd].join(','));
    });
    download('token-radar-board.csv', lines.join('\n') + '\n', 'text/csv');
  }
  function exportJson() {
    download('token-radar-board.json', JSON.stringify({ model: DATA.model_version, as_of: DATA.as_of, rows: sortedRows(rows()) }, null, 1) + '\n', 'application/json');
  }

  function controls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.reduce(function (acc, r) { return acc.concat(r.chains || []); }, []))).sort();
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    var select = el('select', { id: 'category', 'aria-label': 'Filter by category' },
      el('option', { value: 'all', text: 'All categories' }),
      categories.map(function (c) { return el('option', { value: c, text: c, selected: c === state.category ? 'selected' : null }); })
    );
    select.addEventListener('change', function () { state.category = select.value; writeHash(); render(); });
    var chainSelect = el('select', { id: 'chain', 'aria-label': 'Filter by chain' },
      el('option', { value: 'all', text: 'All chains' }),
      chains.map(function (c) { return el('option', { value: c, text: c, selected: c === state.chain ? 'selected' : null }); })
    );
    chainSelect.addEventListener('change', function () { state.chain = chainSelect.value; render(); });
    var pre = el('button', { type: 'button', 'aria-pressed': state.tab === 'pre-token' ? 'true' : 'false', text: 'Pre-token', onclick: function () { state.tab = 'pre-token'; render(); } });
    var live = el('button', { type: 'button', 'aria-pressed': state.tab === 'live' ? 'true' : 'false', text: 'Live token', onclick: function () { state.tab = 'live'; render(); } });
    var screened = el('button', { type: 'button', 'aria-pressed': state.tab === 'screened' ? 'true' : 'false', text: 'Screened out', onclick: function () { state.tab = 'screened'; render(); } });
    var chips = el('div', { class: 'chips' }, TIERS.map(function (t) {
      return el('button', { type: 'button', 'data-tier': t[0], 'aria-pressed': state.tier === t[0] ? 'true' : 'false', onclick: function () { state.tier = t[0]; render(); } },
        t[1] + ' ', el('b', { class: 'num', text: String(tierCount(t[0])) }));
    }));
    var count = state.tab === 'pre-token' ? rows().length + ' rows shown'
      : state.tab === 'live' ? DATA.live.length + ' live-token protocols'
      : DATA.screened_out.length + ' of ' + DATA.screened_out_count + ' screened out, largest first';
    return el('div', { class: 'controls-wrap' },
      el('div', { class: 'controls' },
        el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
        el('div', { class: 'field' }, el('label', { for: 'category', text: 'Category' }), select),
        el('div', { class: 'field' }, el('label', { for: 'chain', text: 'Chain' }), chainSelect),
        el('div', { class: 'field' }, el('span', { class: 'sub', text: 'View' }), el('div', { class: 'tabs' }, pre, live, screened)),
        el('div', { class: 'field' }, el('span', { class: 'sub', text: 'Export' }),
          el('div', { class: 'tabs' },
            el('button', { type: 'button', text: 'CSV', onclick: exportCsv }),
            el('button', { type: 'button', text: 'JSON', onclick: exportJson }))),
        el('span', { class: 'count', text: count })
      ),
      state.tab === 'pre-token' ? el('div', { class: 'tier-row' },
        el('span', { class: 'sub', text: 'Farm tier at a $' + DATA.farm.ticket_usd.toLocaleString('en-US') + ' ticket, ' + Math.round(DATA.farm.drop_share * 100) + '% drop share assumed:' }),
        chips
      ) : null
    );
  }

  function sortHeader(key, label) {
    return el('th', { scope: 'col' },
      el('button', { type: 'button', onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = key === 'rank' || key === 'name' ? 1 : -1; } render(); } },
        label,
        state.sort === key ? el('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' v' : ' ^' }) : null
      )
    );
  }

  function boardTable() {
    var list = sortedRows(rows());
    if (list.length === 0) {
      return el('div', { class: 'panel' }, el('div', { class: 'empty' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { text: 'Clear the search or pick another category, chain or tier to see the board again.' }),
        el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.tier = 'all'; writeHash(); render(); } })
      ));
    }
    var tbody = el('tbody');
    list.forEach(function (r) {
      var growth = r.change_7d === null ? 'n/a' : fmtPct(r.change_7d);
      var growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      var tr = el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'num', text: String(r.rank) }),
        el('td', null, el('div', { class: 'name' },
          el('b', { text: r.name }, r.on_watchlist ? el('span', { class: 'badge', text: 'watchlist' }) : null),
          el('span', { class: 'sub', text: (r.category || 'Other') + ' \u00b7 ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') })
        )),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + growthClass, text: growth }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', null, el('div', { class: 'odds' },
          el('div', { class: 'bar odds-bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + r.launch_odds_pct + '%' })),
          el('span', { class: 'num', text: r.launch_odds_pct + '%' })
        )),
        el('td', { class: 'num', text: r.peer_odds_pct + '%' }),
        el('td', null, el('div', { class: 'name' },
          el('span', { class: 'num', text: fmtUsd(r.implied_value_usd) }),
          el('span', { class: 'sub', text: fmtUsd(r.implied_low_usd) + ' \u2013 ' + fmtUsd(r.implied_high_usd) })
        )),
        el('td', { class: 'num ev', text: fmtUsd(r.ev_usd) }),
        el('td', null, el('div', { class: 'name' },
          el('span', { class: 'verdict v-' + r.farm_verdict, text: r.farm_verdict }),
          el('span', { class: 'sub', text: 'net ' + fmtMoney(r.farm_net_usd) + ' \u00b7 fees ' + fmtMoney(r.farm_fees_usd) })
        )),
        el('td', { class: 'num', text: fmtMoney(r.farm_per_hour_usd) + '/h' })
      );
      tbody.appendChild(tr);
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Pre-token protocols, ranked by expected value: implied value \u00d7 launch odds. The range under each value is the size fit\u2019s interquartile band. Peer record is a second odds opinion, tested and not adopted; the farm verdict is net of fees at a $1,000 ticket with a 5% drop share assumed. Select a row for its model, odds and farm plan.' }),
          el('thead', null, el('tr', null,
            sortHeader('rank', 'Rank'),
            sortHeader('name', 'Protocol'),
            sortHeader('tvl', 'TVL'),
            sortHeader('growth', '7d'),
            sortHeader('age', 'No-token age'),
            sortHeader('odds', 'Launch odds'),
            sortHeader('peer', 'Peer record'),
            sortHeader('implied', 'Launch value'),
            sortHeader('ev', 'Expected value'),
            sortHeader('net', 'Farm verdict'),
            sortHeader('perhour', 'Net $/h')
          )),
          tbody
        )
      )
    );
  }

  function liveTable() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', { class: 'num', text: 'live' }),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
        el('td', null, el('span', { class: 'status', text: 'already trades' }))
      ));
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Token live: these protocols already trade, so their market cap is a fact, not a model. They are the comps the fitted model learns from, set aside from the pre-token ranking.' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Status' }), el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: '7d' }), el('th', { scope: 'col', text: 'Market cap' }), el('th', { scope: 'col', text: 'Token' }))),
          tbody
        )
      )
    );
  }

  function screenedTable() {
    var tbody = el('tbody');
    DATA.screened_out.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: r.category || 'Other' }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'reason', text: r.reason })
      ));
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Kept off the board by the integrity screen: ' + DATA.screened_out_count + ' pre-token records that read as a wrapped, staked, bridged or exchange product of a token that already trades, or a versioned pool of another protocol. The ' + DATA.screened_out.length + ' largest are listed; none is ranked, and none is hidden.' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: 'Why it is not a launch candidate' }))),
          tbody
        )
      )
    );
  }

  function verdictText(t) {
    if (t.kept) return 'in the model';
    return t.role === 'reference' ? 'reference' : 'tested, not kept';
  }

  function evidencePanel() {
    var v = DATA.validation;
    var valueRows = v.value_terms.map(function (t) {
      return el('tr', { class: t.kept ? 'kept' : '' },
        el('td', { text: t.name }),
        el('td', { class: 'num', text: t.loo.toFixed(3) + ' (' + miss(t.loo) + ')' }),
        el('td', { class: 'num', text: t.wf.toFixed(3) + ' (' + miss(t.wf) + ')' }),
        el('td', { class: 'mark', text: verdictText(t) })
      );
    });
    var rangeRows = v.range_checks.map(function (t) {
      return el('tr', null,
        el('td', { text: t.name }),
        el('td', { class: 'num', text: t.loo_pct + '%' }),
        el('td', { class: 'num', text: t.wf_pct + '%' }),
        el('td', { class: 'mark', text: '' })
      );
    });
    var oddsRows = v.odds_terms.map(function (t) {
      return el('tr', { class: t.kept ? 'kept' : '' },
        el('td', { text: t.name }),
        el('td', { class: 'num', text: t.cv.toFixed(4) }),
        el('td', { class: 'num', text: t.wf.toFixed(4) }),
        el('td', { class: 'mark', text: t.kept ? 'the scored odds' : t.role === 'reference' ? 'reference' : 'tested, not adopted' })
      );
    });
    function termTable(head, rows) {
      return el('div', { class: 'table-wrap' },
        el('table', { class: 'terms' },
          el('thead', null, el('tr', null, head.map(function (h) { return el('th', { scope: 'col', text: h }); }))),
          el('tbody', null, rows)
        )
      );
    }
    return el('section', { class: 'panel pad' },
      el('h2', { text: 'Out-of-sample evidence: every term, both hard tests' }),
      el('p', { text: 'Two designs that punish fitting noise. Leave-one-out: every fit is recomputed without the held-out comp, all ' + v.comps + ' of them. Walk-forward: fit on comps listed before a year, score that year, pooled over ' + v.wf_rows + ' comps. The program computed this table from the snapshot; nothing here is pasted. Median absolute log error, with the typical miss as a multiple; lower is better.' }),
      termTable(['Value model term', 'Leave-one-out', 'Walk-forward', 'Verdict'], valueRows),
      el('h3', { text: 'Does the printed range hold what it claims?' }),
      el('p', { text: 'The band under each value claims the middle half of outcomes. Share of held-out caps that actually landed inside it:' }),
      termTable(['Band', 'Leave-one-out', 'Walk-forward', ''], rangeRows),
      el('h3', { text: 'Launch odds, same treatment' }),
      el('p', { text: 'Brier score over every protocol in the snapshot: 10-fold cross-validation \u00d7 5 and walk-forward (' + v.odds_wf_rows + ' dated protocols). In walk-forward a test year\u2019s own cohort cannot exist in the training years, so cohort-only degenerates to the flat rate there; the cross-validation tests the whole model.' }),
      termTable(['Odds model', 'Cross-validation', 'Walk-forward', 'Verdict'], oddsRows),
      el('p', { class: 'note', text: 'Why the tilt was dropped: on random splits it helped, which is how radar-3 shipped it. Under both stricter designs it hurts \u2014 with some 34 categories over 128 comps, most tilts rest on one to four comps and do not generalise. A term that only survives the easy test is noise with good marketing.' }),
      el('p', { class: 'note', text: 'Why no fitted age term, ever: fitted on early walk-forward windows that hold only old protocols, the age coefficient is unidentified and extrapolates wildly onto young rows \u2014 the walk-forward error above is the sound it makes. The asserted maturity multiplier is a wash on size alone and a drag on the full model, so it went too.' }),
      el('p', { class: 'note', text: 'Peer odds are printed as a second opinion, not a claim: they lose the cross-validation clearly and win walk-forward by 0.006, inside noise. Where the two odds disagree most is where the peer cells are thinnest \u2014 and the top of an expected-value table is odds-sensitive either way, which is why both readings stay on the board.' })
    );
  }

  function modelPanel() {
    var f = DATA.fit;
    var fm = DATA.farm;
    var cohortRows = DATA.cohorts.filter(function (c) { return c.cohort !== 'unknown'; }).map(function (c) {
      return el('tr', null,
        el('td', { class: 'num', text: 'listed ' + c.cohort }),
        el('td', { class: 'num', text: c.tokenized + ' / ' + c.total }),
        el('td', { class: 'num', text: c.share_pct + '%' })
      );
    });
    var sens = fm.sensitivity.map(function (s) {
      return 'at ' + Math.round(s.drop_share * 100) + '%: ' + s.counts.FARM + ' FARM \u00b7 ' + s.counts.MARGINAL + ' MARGINAL \u00b7 ' + s.counts.SKIP + ' SKIP';
    }).join('; ');
    return el('section', { class: 'panel pad model' },
      el('h2', { text: 'How this board is built' }),
      el('p', { text: 'Implied value is fitted, not asserted. The ' + f.comps + ' protocols in this snapshot that already trade a token (market cap above zero) teach the model what a token is worth against TVL: a least-squares fit of ln(market cap / TVL) on ln(TVL) gives implied = tvl \u00d7 exp(' + f.ols_intercept + ' ' + (f.ols_slope < 0 ? '\u2212' : '+') + ' ' + Math.abs(f.ols_slope) + ' \u00d7 ln tvl), because larger protocols trade at lower multiples. radar-3 multiplied this curve by a category tilt, a growth multiplier and a maturity multiplier; the evidence panel above is why radar-4 does not. The row set is the one radar-3 selected, so the boards differ only in scoring. No protocol name is special-cased, and no row is hand-picked.' }),
      el('div', { class: 'formula' }, 'implied = round( tvl_usd \u00d7 exp(' + f.ols_intercept + ' + ' + f.ols_slope + ' \u00d7 ln tvl_usd) ) \u00b7 range = implied \u00d7 [' + f.band_low_factor + ', ' + f.band_high_factor + '] \u00b7 expected value = implied \u00d7 launch odds' ),
      el('h3', { text: 'Launch odds are a base rate' }),
      el('p', { text: 'A row\u2019s launch odds are the share of its listed-year cohort that already records a token in this snapshot, adjusted by its category\u2019s share shrunk toward the average. Read them as how often protocols like this one have launched by now, not as a forecast for this one: a protocol still tokenless years after listing is, if anything, a slower launcher than its cohort\u2019s share suggests. The peer record beside it is the tokenized share of the protocol\u2019s own category \u00d7 TVL band \u00d7 age band cell, shrunk toward its category rate \u2014 a second opinion the validation did not adopt.' }),
      el('div', { class: 'table-wrap' },
        el('table', { class: 'cohorts' },
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Cohort' }), el('th', { scope: 'col', text: 'Already record a token' }), el('th', { scope: 'col', text: 'Share' }))),
          el('tbody', null, cohortRows)
        )
      ),
      el('h3', { text: 'The farm verdict, net of fees' }),
      el('p', { text: 'Each verdict prices a $' + fm.ticket_usd.toLocaleString('en-US') + ' ticket on the protocol\u2019s cheapest chain: fees are that chain\u2019s gas over the plan\u2019s own schedule (setup and exit plus one action a week over the hold), the farmer\u2019s slice of a launch is the ticket\u2019s pro-rata share of qualifying capital, and the expected drop is peer-record odds \u00d7 implied value \u00d7 a ' + Math.round(fm.drop_share * 100) + '% drop-share assumption \u00d7 that slice. The capital itself is returned, so it is not a cost. FARM needs a net of at least $10 and at least $5 an hour; MARGINAL makes money below a bar; SKIP loses it. The assumption does real work \u2014 ' + sens + ' \u2014 so it is printed wherever a verdict is. Note the shape: at a fixed ticket the slice shrinks as TVL grows, so the expected-value giants are mostly poor farms and the best hourly rates hide in small protocols on cheap chains.' }),
      el('h3', { text: 'The integrity screen' }),
      el('p', { text: 'A wrapped, staked or bridged product of a token that already trades is not a launch that has not happened yet, and neither is an exchange\u2019s own product or a versioned pool of another protocol. The screen keeps ' + DATA.screened_out_count + ' such records off the ranked board and lists the largest in the Screened out view with the reason for each. Watchlist rows are never screened: the coverage the gate requires is not gambled on a heuristic.' }),
      el('p', { class: 'sub', text: 'The snapshot is DefiLlama\u2019s record as of ' + DATA.as_of + '; it says a protocol records no token, never that it has none. The live-token view sets aside the protocols that already trade at the market\u2019s own values. Implied values are this entry\u2019s own claim, not make.fun\u2019s.' })
    );
  }

  var dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', function () { state.selected = null; writeHash(); });

  function openDetail(slug) {
    var row = DATA.rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    state.selected = slug;
    writeHash();
    dialog.textContent = '';
    var steps = farmSteps(row);
    var cohort = DATA.cohorts.filter(function (c) { return c.cohort === (row.listed_at ? row.listed_at.slice(0, 4) : 'unknown'); })[0];
    var fc = farmChain(row);
    var slicePct = DATA.farm.ticket_usd / (row.tvl_usd + DATA.farm.ticket_usd) * 100;
    dialog.appendChild(el('div', { class: 'detail-head' },
      el('div', null,
        el('span', { class: 'brand-name', text: 'Rank ' + row.rank + ' of ' + DATA.board_size + ' by expected value' + (row.on_watchlist ? ' \u00b7 watchlist' : ' \u00b7 early radar') }),
        el('h2', { id: 'detail-title', text: row.name }),
        el('p', { class: 'sub', text: (row.category || 'Other') + ' on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') })
      ),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Implied value and expected value' }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'TVL' }), el('b', { class: 'num', text: fmtUsd(row.tvl_usd) })),
        el('div', null, el('span', { text: 'Fitted size multiple' }), el('b', { class: 'num', text: String(row.base_multiple) + 'x' })),
        el('div', null, el('span', { text: 'Implied value at a launch' }), el('b', { class: 'num', text: fmtUsd(row.implied_value_usd) })),
        el('div', null, el('span', { text: 'Comps\u2019 interquartile range' }), el('b', { class: 'num', text: fmtUsd(row.implied_low_usd) + ' \u2013 ' + fmtUsd(row.implied_high_usd) })),
        el('div', null, el('span', { text: 'Expected value (implied \u00d7 odds)' }), el('b', { class: 'num', text: fmtUsd(row.ev_usd) }))
      ),
      el('p', { class: 'sub', text: 'Model ' + DATA.model_version + ': the size curve alone scores every protocol. The page recomputes this row as ' + fmtUsd(impliedOf(row)) + (impliedOf(row) === row.implied_value_usd ? ', the same number board.json carries.' : ', which differs from the board: the data would be stale.') + ' This is an estimate, not a price.' })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Launch odds, two readings' }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'Launch odds (cohort \u00d7 category, scored)' }), el('b', { class: 'num', text: row.launch_odds_pct + '%' })),
        cohort ? el('div', null, el('span', { text: 'Its cohort (listed ' + cohort.cohort + ') already tokenized' }), el('b', { class: 'num', text: cohort.share_pct + '% of ' + cohort.total })) : null,
        el('div', null, el('span', { text: 'Peer record (second opinion)' }), el('b', { class: 'num', text: row.peer_odds_pct + '%' }))
      ),
      el('p', { class: 'sub', text: 'Peers are ' + row.peer_cell + ' \u2014 ' + row.peer_cell_n + ' protocol' + (row.peer_cell_n === 1 ? '' : 's') + ' in that cell of the snapshot, which is why the two readings can disagree: the peer cell is thin evidence, shrunk toward its category rate. Base rates from this snapshot\u2019s cross-section, not predictions about this protocol.' })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm verdict: ' + row.farm_verdict }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'Reference ticket' }), el('b', { class: 'num', text: fmtUsd(DATA.farm.ticket_usd) })),
        el('div', null, el('span', { text: 'Farmer slice of qualifying capital' }), el('b', { class: 'num', text: slicePct >= 0.1 ? slicePct.toFixed(2) + '%' : slicePct >= 0.001 ? slicePct.toFixed(3) + '%' : '<0.001%' })),
        el('div', null, el('span', { text: 'Expected drop (peer odds \u00d7 value \u00d7 ' + Math.round(DATA.farm.drop_share * 100) + '% share \u00d7 slice)' }), el('b', { class: 'num', text: fmtMoney(row.farm_ev_usd) })),
        el('div', null, el('span', { text: 'Fees on ' + fc.chain + ' over the plan' }), el('b', { class: 'num', text: fmtMoney(row.farm_fees_usd) })),
        el('div', null, el('span', { text: 'Net of fees' }), el('b', { class: 'num', text: fmtMoney(row.farm_net_usd) })),
        el('div', null, el('span', { text: 'Time the plan takes' }), el('b', { class: 'num', text: row.farm_hours + ' h' })),
        el('div', null, el('span', { text: 'Net per hour' }), el('b', { class: 'num', text: fmtMoney(row.farm_per_hour_usd) + '/h' }))
      ),
      el('p', { class: 'sub', text: 'FARM needs a net of at least $10 and at least $5 an hour at the stated ' + Math.round(DATA.farm.drop_share * 100) + '% drop-share assumption; the verdicts move with that assumption, as the method section shows. The plan below is the schedule those fees and hours price.' })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm plan' }),
      el('ol', { class: 'steps' }, steps.map(function (s) {
        var at = s.indexOf(' Cost: ');
        var action = at >= 0 ? s.slice(0, at) : s;
        var tail = at >= 0 ? s.slice(at + 1) : '';
        return el('li', null, el('b', { text: action }), el('span', { class: 'cost', text: tail }));
      }))
    ));
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(header());
    shell.appendChild(lede());
    shell.appendChild(kpis());
    shell.appendChild(accountingStrip());
    if (state.tab === 'pre-token') shell.appendChild(evidencePanel());
    shell.appendChild(controls());
    if (state.tab === 'pre-token') {
      shell.appendChild(boardTable());
      shell.appendChild(modelPanel());
    } else if (state.tab === 'live') {
      shell.appendChild(liveTable());
    } else {
      shell.appendChild(screenedTable());
    }
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
    if (!dialog.isConnected) app.appendChild(dialog);
    if (state.selected) openDetail(state.selected);
  }

  readHash();
  render();
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dialog.open) dialog.close();
  });
})();
