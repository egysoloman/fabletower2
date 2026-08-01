/**
 * Admin dashboard: one self-contained HTML page served at /admin. The page
 * itself is public (it contains nothing sensitive); every data call requires
 * the NS_ADMIN_KEY header, entered in the UI and kept in sessionStorage.
 */
export const adminHtml = (apiBase: string) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>NEONSPIRE · ADMIN</title>
<style>
:root{--bg:#060312;--panel:#100826;--cyan:#00e5ff;--pink:#ff2d95;--gold:#ffd166;--red:#ff3b5b;--green:#3dffa2;--dim:#8f86b8;--text:#e8e4ff}
*{margin:0;padding:0;box-sizing:border-box}
body{background:var(--bg);color:var(--text);font:14px/1.5 'Courier New',monospace;padding:24px;max-width:1000px;margin:0 auto}
h1{letter-spacing:.2em;font-size:20px;color:var(--cyan);margin-bottom:18px}
h1 span{color:var(--pink)}
h2{font-size:13px;letter-spacing:.15em;color:var(--dim);margin:22px 0 8px}
.cards{display:flex;gap:12px;flex-wrap:wrap;margin:14px 0}
.card{border:1px solid rgba(0,229,255,.35);background:var(--panel);padding:12px 18px;border-radius:6px;min-width:130px}
.card b{display:block;font-size:22px;color:var(--cyan)}
.card small{color:var(--dim);font-size:11px;letter-spacing:.1em}
input,button{background:rgba(0,229,255,.06);border:1px solid rgba(0,229,255,.5);color:var(--text);padding:8px 12px;border-radius:4px;font:inherit}
button{cursor:pointer;color:var(--cyan);text-transform:uppercase;font-size:12px;letter-spacing:.1em}
button:hover{background:rgba(0,229,255,.18)}
button.warn{color:var(--red);border-color:rgba(255,59,91,.6)}
button.gold{color:var(--gold);border-color:rgba(255,209,102,.6)}
table{width:100%;border-collapse:collapse;margin-top:8px}
th,td{padding:7px 10px;text-align:left;border-bottom:1px solid rgba(143,134,184,.2);font-size:13px}
th{color:var(--dim);font-size:11px;letter-spacing:.12em;text-transform:uppercase}
tr.banned td{color:var(--red);opacity:.75}
.row{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:8px 0}
#msg{color:var(--green);min-height:18px;margin:8px 0}
#msg.err{color:var(--red)}
.pill{display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;border:1px solid currentColor}
.on{color:var(--green)}.off{color:var(--red)}
td .mini{padding:4px 8px;font-size:11px;margin-right:4px}
.analytics{border:1px solid rgba(0,229,255,.22);background:rgba(0,229,255,.025);border-radius:7px;padding:12px;margin:8px 0 16px;overflow:auto}
.bounds{display:flex;flex-direction:column;gap:8px;min-width:620px;margin:8px 0 14px}
.bound{display:grid;grid-template-columns:70px 1fr 95px 180px;gap:10px;align-items:center;font-size:12px}
.track{height:8px;border-radius:8px;background:rgba(143,134,184,.2);position:relative}
.track i{position:absolute;width:10px;height:10px;border-radius:50%;top:50%;transform:translate(-50%,-50%);z-index:2}
.track .lo{background:var(--red);box-shadow:0 0 7px var(--red)}.track .hi{background:var(--green);box-shadow:0 0 7px var(--green)}
.track span{position:absolute;height:4px;top:2px;background:var(--gold)}
.muted{color:var(--dim);font-size:11px}.analytics h3{font-size:11px;color:var(--gold);letter-spacing:.12em;margin:12px 0 4px}
</style></head><body>
<h1>NEON<span>SPIRE</span> · ADMIN</h1>
<div class="row">
  <input id="key" type="password" placeholder="NS_ADMIN_KEY" style="width:260px">
  <button onclick="saveKey()">CONNECT</button>
  <span id="regstate"></span>
</div>
<div id="msg"></div>
<div id="app" style="display:none">
  <div class="cards">
    <div class="card"><b id="c-total">–</b><small>ACCOUNTS</small></div>
    <div class="card"><b id="c-today">–</b><small>SYNCED TODAY</small></div>
    <div class="card"><b id="c-banned">–</b><small>BANNED</small></div>
    <div class="card"><b id="c-scores">–</b><small>DAILY SCORES</small></div>
    <div class="card"><b id="c-mode">–</b><small>MP MODE</small></div>
    <div class="card"><b id="c-runs">–</b><small>RECORDED RUNS</small></div>
    <div class="card"><b id="c-winrate">–</b><small>PLAYER WIN RATE</small></div>
  </div>
  <h2>BALANCE ANALYTICS</h2>
  <div id="balance" class="analytics"></div>
  <h2>ACCOUNTS</h2>
  <div class="row"><input id="search" placeholder="search…" oninput="render()">
    <button onclick="toggleReg()" id="regbtn">TOGGLE REGISTRATIONS</button>
    <button onclick="toggleMode()" id="modebtn">TOGGLE MP MODE</button>
    <button class="gold" onclick="exportDb()">EXPORT DB</button>
    <button class="warn" onclick="importDb()">IMPORT DB</button>
    <input type="file" id="importfile" accept=".json" style="display:none">
  </div>
  <table><thead><tr><th>USER</th><th>CREATED</th><th>LAST SYNC</th><th>STATE</th><th>CHEATS</th><th>ACTIONS</th></tr></thead>
  <tbody id="rows"></tbody></table>
</div>
<script>
const API = '${apiBase}'
let KEY = sessionStorage.getItem('ns-admin-key') || ''
let DATA = null
let BALANCE = null
let BENCH = null
const $ = (id) => document.getElementById(id)
const msg = (t, err) => { $('msg').textContent = t; $('msg').className = err ? 'err' : '' }
const esc = (v) => String(v).replace(/[&<>\"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]))
async function api(path, method, body) {
  const res = await fetch(path, { method: method || 'GET',
    headers: { 'content-type': 'application/json', 'x-admin-key': KEY },
    body: body === undefined ? undefined : JSON.stringify(body) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.err || ('http ' + res.status))
  return data
}
function saveKey() { KEY = $('key').value.trim(); sessionStorage.setItem('ns-admin-key', KEY); load() }
async function load() {
  try {
    const loaded = await Promise.all([
      api(API + '/accounts'), api(API + '/balance'),
      fetch('/api/daily/leaderboard').then((r) => r.json()).catch(() => ({ top: [] })),
      fetch('/balance/latest.json').then((r) => r.ok ? r.json() : null).catch(() => null)
    ])
    DATA = loaded[0]; BALANCE = loaded[1]; const board = loaded[2]; BENCH = loaded[3]
    $('app').style.display = ''
    msg('connected ✓')
    const dayAgo = Date.now() - 864e5
    $('c-total').textContent = DATA.accounts.length
    $('c-today').textContent = DATA.accounts.filter((a) => a.blobUpdated > dayAgo).length
    $('c-banned').textContent = DATA.accounts.filter((a) => a.banned).length
    $('c-scores').textContent = board.top.length
    $('c-mode').textContent = DATA.mpMode.toUpperCase() + (DATA.mpEnvLocked ? ' (env)' : '')
    $('c-runs').textContent = BALANCE.runs
    $('c-winrate').textContent = BALANCE.winRate + '%'
    $('modebtn').disabled = !!DATA.mpEnvLocked
    $('regstate').innerHTML = DATA.registrationsOpen
      ? '<span class="pill on">registrations OPEN</span>' : '<span class="pill off">registrations CLOSED</span>'
    renderBalance(); render()
  } catch (e) { $('app').style.display = 'none'; msg(String(e.message), true) }
}
function renderBalance() {
  const actualRows = (BALANCE.byChar || []).map((r) => '<tr><td>' + esc(String(r.id).toUpperCase()) + '</td><td>' + r.runs + '</td><td>' + r.winRate + '%</td><td>' + r.avgFloor + '</td><td>' + r.p25Floor + '/' + r.medianFloor + '/' + r.p75Floor + '</td><td>' + Object.values(r.deathByAct).join('/') + '</td><td>' + r.avgDeck + '/' + r.avgUpgrades + '/' + r.avgRelics + '</td></tr>').join('')
  const archRows = (BALANCE.byArchetype || []).slice(0, 12).map((r) => '<tr><td>' + esc(r.id) + '</td><td>' + r.runs + '</td><td>' + r.winRate + '%</td><td>' + r.avgFloor + '</td><td>' + r.p25Floor + '/' + r.medianFloor + '/' + r.p75Floor + '</td><td>' + r.avgScore + '</td></tr>').join('')
  let benchmark = '<div class="muted">No committed bot benchmark available.</div>'
  if (BENCH) {
    const bounds = BENCH.comparison.map((r) => {
      const lo = Math.max(0, Math.min(100, r.lowerMean / 24 * 100)); const hi = Math.max(0, Math.min(100, r.upperMean / 24 * 100))
      return '<div class="bound"><b>' + esc(r.char.toUpperCase()) + '</b><div class="track"><span style="left:' + lo + '%;width:' + Math.max(0, hi-lo) + '%"></span><i class="lo" style="left:' + lo + '%"></i><i class="hi" style="left:' + hi + '%"></i></div><strong>' + r.lowerMean + ' → ' + r.upperMean + '</strong><small>' + esc(r.bestArchetype) + '</small></div>'
    }).join('')
    benchmark = '<div class="muted">BOT BOUNDS · A' + BENCH.ascension + ' · ' + BENCH.seeds + ' seeds/profile · ' + esc(BENCH.generatedAt.slice(0,10)) + ' · red=floor / green=ceiling envelope</div><div class="bounds">' + bounds + '</div>'
  }
  $('balance').innerHTML = benchmark + '<h3>ANONYMIZED PLAYER RUNS</h3><div class="muted">' + BALANCE.accountsWithHistory + ' accounts with history · latest 100 runs/account · 30d ' + BALANCE.recent30d.runs + ' runs / ' + BALANCE.recent30d.winRate + '% wins</div><table><thead><tr><th>CHAR</th><th>RUNS</th><th>WIN</th><th>AVG FLOOR</th><th>P25/P50/P75</th><th>DEATH A1/A2/A3/A4</th><th>DECK/UP/RELIC</th></tr></thead><tbody>' + actualRows + '</tbody></table><h3>PLAYER ARCHETYPES</h3><table><thead><tr><th>ARCHETYPE</th><th>RUNS</th><th>WIN</th><th>AVG FLOOR</th><th>P25/P50/P75</th><th>AVG SCORE</th></tr></thead><tbody>' + archRows + '</tbody></table>'
}
function render() {
  const q = $('search').value.toLowerCase()
  const fmt = (t) => (t ? new Date(t).toISOString().slice(0, 16).replace('T', ' ') : '—')
  $('rows').innerHTML = DATA.accounts
    .filter((a) => !q || a.user.includes(q))
    .sort((a, b) => b.created - a.created)
    .map((a) => '<tr class="' + (a.banned ? 'banned' : '') + '"><td>' + a.name + '</td><td>' + fmt(a.created) +
      '</td><td>' + fmt(a.blobUpdated) + '</td><td>' + (a.banned ? 'BANNED' : 'ok') + '</td><td>' +
      (a.cheatsEnabled ? '<span class="pill on">ENABLED</span>' : '<span class="pill off">OFF</span>') + '</td><td>' +
      '<button class="mini gold" onclick="cheats(\\'' + a.user + '\\',' + !a.cheatsEnabled + ')">' + (a.cheatsEnabled ? 'DISABLE CHEATS' : 'ENABLE CHEATS') + '</button>' +
      '<button class="mini" onclick="ban(\\'' + a.user + '\\',' + !a.banned + ')">' + (a.banned ? 'UNBAN' : 'BAN') + '</button>' +
      '<button class="mini" onclick="resetPw(\\'' + a.user + '\\')">RESET PW</button>' +
      '<button class="mini warn" onclick="del(\\'' + a.user + '\\')">DELETE</button></td></tr>')
    .join('')
}
async function ban(user, banned) { try { await api(API + '/ban', 'POST', { user, banned }); load() } catch (e) { msg(e.message, true) } }
async function cheats(user, enabled) { try { await api(API + '/cheats', 'POST', { user, enabled }); load() } catch (e) { msg(e.message, true) } }
async function resetPw(user) {
  const pass = prompt('New password for ' + user + ' (6+ chars):')
  if (!pass) return
  try { await api(API + '/reset', 'POST', { user, pass }); msg('password reset for ' + user) } catch (e) { msg(e.message, true) }
}
async function del(user) {
  if (!confirm('Delete account "' + user + '" permanently?')) return
  try { await api(API + '/accounts/' + user, 'DELETE'); load() } catch (e) { msg(e.message, true) }
}
async function toggleMode() {
  try { await api(API + '/mpmode', 'POST', { mode: DATA.mpMode === 'hybrid' ? 'strict' : 'hybrid' }); load() } catch (e) { msg(e.message, true) }
}
async function toggleReg() {
  try { await api(API + '/registrations', 'POST', { open: !DATA.registrationsOpen }); load() } catch (e) { msg(e.message, true) }
}
async function exportDb() {
  try {
    const db = await api(API + '/export')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' }))
    a.download = 'neonspire-db-' + new Date().toISOString().slice(0, 10) + '.json'
    a.click()
  } catch (e) { msg(e.message, true) }
}
function importDb() {
  const f = $('importfile')
  f.onchange = async () => {
    const file = f.files && f.files[0]
    if (!file) return
    if (!confirm('Importing REPLACES the whole database. Continue?')) return
    try { await api(API + '/import', 'POST', JSON.parse(await file.text())); msg('imported ✓'); load() }
    catch (e) { msg(e.message, true) }
  }
  f.click()
}
if (KEY) { $('key').value = KEY; load() }
</script></body></html>`
