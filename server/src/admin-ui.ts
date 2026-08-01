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
body{background:var(--bg);color:var(--text);font:14px/1.5 'Courier New',monospace;padding:24px;max-width:1120px;margin:0 auto}
h1{letter-spacing:.2em;font-size:20px;color:var(--cyan)}
h1 span{color:var(--pink)}
h2{font-size:13px;letter-spacing:.15em;color:var(--dim);margin:22px 0 8px}
.topbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:18px}
.cards{display:flex;gap:12px;flex-wrap:wrap;margin:14px 0}
.card{border:1px solid rgba(0,229,255,.35);background:var(--panel);padding:12px 18px;border-radius:6px;min-width:130px}
.card b{display:block;font-size:22px;color:var(--cyan)}
.card small{color:var(--dim);font-size:11px;letter-spacing:.1em}
input,button{background:rgba(0,229,255,.06);border:1px solid rgba(0,229,255,.5);color:var(--text);padding:8px 12px;border-radius:4px;font:inherit}
button{cursor:pointer;color:var(--cyan);text-transform:uppercase;font-size:12px;letter-spacing:.1em}
button:hover{background:rgba(0,229,255,.18)}button:disabled{cursor:not-allowed;opacity:.45}
button.warn{color:var(--red);border-color:rgba(255,59,91,.6)}button.gold{color:var(--gold);border-color:rgba(255,209,102,.6)}
table{width:100%;border-collapse:collapse;margin-top:8px;white-space:nowrap}
th,td{padding:7px 10px;text-align:left;border-bottom:1px solid rgba(143,134,184,.2);font-size:13px}
th{color:var(--dim);font-size:11px;letter-spacing:.08em;text-transform:uppercase}
tr.banned td{color:var(--red);opacity:.75}
.row{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:8px 0}
#msg{color:var(--green);min-height:18px;margin:8px 0}#msg.err{color:var(--red)}
.pill{display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;border:1px solid currentColor}.on{color:var(--green)}.off{color:var(--red)}
td .mini{padding:4px 8px;font-size:11px;margin:2px 4px 2px 0}
.analytics,.account-table{overflow:auto}
.analytics{border:1px solid rgba(0,229,255,.22);background:rgba(0,229,255,.025);border-radius:7px;padding:14px;margin:8px 0 16px}
.muted{color:var(--dim);font-size:11px}.analytics h3{font-size:11px;color:var(--gold);letter-spacing:.12em;margin:16px 0 4px}
.source{border-left:2px solid var(--cyan);padding-left:9px;margin-bottom:10px}.empty{padding:22px 8px;text-align:center;color:var(--dim)}
@media(max-width:700px){body{padding:14px}.topbar{align-items:flex-start}.card{min-width:calc(50% - 6px);padding:10px}.row input{width:100%}}
</style></head><body>
<div class="topbar"><h1>NEON<span>SPIRE</span> · ADMIN</h1><button id="langbtn" onclick="toggleLanguage()">中文</button></div>
<div class="row">
  <input id="key" type="password" placeholder="NS_ADMIN_KEY" style="width:260px">
  <button id="connectbtn" onclick="saveKey()" data-i18n="connect">CONNECT</button>
  <span id="regstate"></span>
</div>
<div id="msg"></div>
<div id="app" style="display:none">
  <div class="cards">
    <div class="card"><b id="c-total">–</b><small data-i18n="accounts">ACCOUNTS</small></div>
    <div class="card"><b id="c-today">–</b><small data-i18n="syncedToday">SYNCED TODAY</small></div>
    <div class="card"><b id="c-banned">–</b><small data-i18n="banned">BANNED</small></div>
    <div class="card"><b id="c-scores">–</b><small data-i18n="dailyScores">DAILY SCORES</small></div>
    <div class="card"><b id="c-mode">–</b><small data-i18n="mpMode">MP MODE</small></div>
    <div class="card"><b id="c-runs">–</b><small data-i18n="recordedRuns">PLAYER RUNS</small></div>
    <div class="card"><b id="c-winrate">–</b><small data-i18n="playerWinRate">PLAYER WIN RATE</small></div>
  </div>
  <h2 data-i18n="balanceAnalytics">PLAYER BALANCE ANALYTICS</h2>
  <div id="balance" class="analytics"></div>
  <h2 data-i18n="accounts">ACCOUNTS</h2>
  <div class="row"><input id="search" oninput="render()">
    <button onclick="toggleReg()" id="regbtn" data-i18n="toggleRegistrations">TOGGLE REGISTRATIONS</button>
    <button onclick="toggleMode()" id="modebtn" data-i18n="toggleMpMode">TOGGLE MP MODE</button>
    <button class="gold" onclick="exportDb()" data-i18n="exportDb">EXPORT DB</button>
    <button class="warn" onclick="importDb()" data-i18n="importDb">IMPORT DB</button>
    <input type="file" id="importfile" accept=".json" style="display:none">
  </div>
  <div class="account-table"><table><thead><tr>
    <th data-i18n="user">USER</th><th data-i18n="created">CREATED</th><th data-i18n="lastSync">LAST SYNC</th>
    <th data-i18n="state">STATE</th><th data-i18n="cheats">CHEATS</th><th data-i18n="actions">ACTIONS</th>
  </tr></thead><tbody id="rows"></tbody></table></div>
</div>
<script>
const API = '${apiBase}'
const TEXT = {
  en: {
    connect:'CONNECT',connected:'connected ✓',accounts:'ACCOUNTS',syncedToday:'SYNCED TODAY',banned:'BANNED',dailyScores:'DAILY SCORES',mpMode:'MP MODE',recordedRuns:'PLAYER RUNS',playerWinRate:'PLAYER WIN RATE',
    balanceAnalytics:'PLAYER BALANCE ANALYTICS',toggleRegistrations:'TOGGLE REGISTRATIONS',toggleMpMode:'TOGGLE MP MODE',exportDb:'EXPORT DB',importDb:'IMPORT DB',search:'search accounts…',
    user:'USER',created:'CREATED',lastSync:'LAST SYNC',state:'STATE',cheats:'CHEATS',actions:'ACTIONS',open:'registrations OPEN',closed:'registrations CLOSED',env:'env',
    playerSource:'SOURCE · synchronized cloud player history only; banned and cheat-enabled accounts are excluded.',playerSummary:'{accounts} accounts with history · latest {limit} runs/account · 30d {runs} runs / {wins}% wins · updated {updated}',
    playerRuns:'PLAYER RUNS BY CHARACTER',ascensionStats:'PLAYER RUNS BY ASCENSION',playerArchetypes:'PLAYER ARCHETYPES',waitingRuns:'Not enough real player data yet. Waiting for synchronized completed runs.',waitingArchetypes:'No classified player archetypes yet.',
    char:'CHAR',ascension:'ASCENSION',runs:'RUNS',win:'WIN',avgFloor:'AVG FLOOR',percentiles:'P25/P50/P75',deathActs:'DEATH A1/A2/A3/A4',deckUpRelic:'DECK/UP/RELIC',archetype:'ARCHETYPE',avgScore:'AVG SCORE',
    enabled:'ENABLED',off:'OFF',ok:'OK',disableCheats:'DISABLE CHEATS',enableCheats:'ENABLE CHEATS',unban:'UNBAN',ban:'BAN',resetPw:'RESET PW',deleteAccount:'DELETE',
    newPassword:'New password for {user} (6+ chars):',passwordReset:'password reset for {user}',deleteConfirm:'Delete account "{user}" permanently?',importConfirm:'Importing REPLACES the whole database. Continue?',imported:'imported ✓'
  },
  zh: {
    connect:'连接',connected:'已连接 ✓',accounts:'账户',syncedToday:'今日同步',banned:'已封禁',dailyScores:'每日分数',mpMode:'联机模式',recordedRuns:'玩家对局',playerWinRate:'玩家胜率',
    balanceAnalytics:'真实玩家平衡分析',toggleRegistrations:'切换注册开关',toggleMpMode:'切换联机模式',exportDb:'导出数据库',importDb:'导入数据库',search:'搜索账户…',
    user:'用户',created:'创建时间',lastSync:'最后同步',state:'状态',cheats:'作弊权限',actions:'操作',open:'注册已开放',closed:'注册已关闭',env:'环境锁定',
    playerSource:'数据源 · 仅使用玩家同步到云端的真实对局历史；已封禁和开启作弊权限的账户不参与统计。',playerSummary:'{accounts} 个账户有对局历史 · 每账户最近 {limit} 局 · 近 30 天 {runs} 局 / 胜率 {wins}% · 更新于 {updated}',
    playerRuns:'按角色统计真实玩家对局',ascensionStats:'按晋升等级统计真实玩家对局',playerArchetypes:'真实玩家流派',waitingRuns:'真实玩家样本不足，正在等待玩家完成并同步对局。',waitingArchetypes:'尚无可识别的玩家流派数据。',
    char:'角色',ascension:'晋升',runs:'局数',win:'胜率',avgFloor:'平均层数',percentiles:'P25/P50/P75',deathActs:'死亡幕 A1/A2/A3/A4',deckUpRelic:'牌组/升级/遗物',archetype:'流派',avgScore:'平均分',
    enabled:'已开启',off:'关闭',ok:'正常',disableCheats:'关闭作弊',enableCheats:'开启作弊',unban:'解封',ban:'封禁',resetPw:'重置密码',deleteAccount:'删除',
    newPassword:'为 {user} 设置新密码（至少 6 位）：',passwordReset:'已重置 {user} 的密码',deleteConfirm:'确定永久删除账户“{user}”吗？',importConfirm:'导入会替换整个数据库，确定继续吗？',imported:'导入完成 ✓'
  }
}
let LANG = localStorage.getItem('ns-admin-lang') || (navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en')
let KEY = sessionStorage.getItem('ns-admin-key') || ''
let DATA = null
let BALANCE = null
const $ = (id) => document.getElementById(id)
const tr = (key, vars) => {
  let value = (TEXT[LANG] && TEXT[LANG][key]) || TEXT.en[key] || key
  Object.entries(vars || {}).forEach(([name, replacement]) => { value = value.replaceAll('{' + name + '}', String(replacement)) })
  return value
}
const msg = (value, err) => { $('msg').textContent = value; $('msg').className = err ? 'err' : '' }
const esc = (value) => String(value).replace(/[&<>\"]/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[char]))
const fmt = (value) => value ? new Date(value).toISOString().slice(0,16).replace('T',' ') : '—'
const deaths = (row) => [1,2,3,4].map((act) => row.deathByAct && row.deathByAct[act] || 0).join('/')
async function api(path, method, body) {
  const res = await fetch(path, { method:method || 'GET', headers:{'content-type':'application/json','x-admin-key':KEY}, body:body === undefined ? undefined : JSON.stringify(body) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.err || ('http ' + res.status))
  return data
}
function applyLanguage() {
  document.documentElement.lang = LANG === 'zh' ? 'zh-CN' : 'en'
  $('langbtn').textContent = LANG === 'zh' ? 'EN' : '中文'
  document.querySelectorAll('[data-i18n]').forEach((node) => { node.textContent = tr(node.dataset.i18n) })
  $('search').placeholder = tr('search')
  if (DATA) { renderState(); renderBalance(); render() }
}
function toggleLanguage() { LANG = LANG === 'zh' ? 'en' : 'zh'; localStorage.setItem('ns-admin-lang', LANG); applyLanguage() }
function saveKey() { KEY = $('key').value.trim(); sessionStorage.setItem('ns-admin-key', KEY); load() }
function renderState() {
  $('regstate').innerHTML = DATA.registrationsOpen ? '<span class="pill on">' + tr('open') + '</span>' : '<span class="pill off">' + tr('closed') + '</span>'
  $('c-mode').textContent = DATA.mpMode.toUpperCase() + (DATA.mpEnvLocked ? ' (' + tr('env') + ')' : '')
}
async function load() {
  try {
    const loaded = await Promise.all([api(API + '/accounts'), api(API + '/balance'), fetch('/api/daily/leaderboard').then((res) => res.json()).catch(() => ({top:[]}))])
    DATA = loaded[0]; BALANCE = loaded[1]; const board = loaded[2]
    $('app').style.display = ''; msg(tr('connected'))
    const dayAgo = Date.now() - 864e5
    $('c-total').textContent = DATA.accounts.length
    $('c-today').textContent = DATA.accounts.filter((account) => account.blobUpdated > dayAgo).length
    $('c-banned').textContent = DATA.accounts.filter((account) => account.banned).length
    $('c-scores').textContent = board.top.length
    $('c-runs').textContent = BALANCE.runs
    $('c-winrate').textContent = BALANCE.runs ? BALANCE.winRate + '%' : '—'
    $('modebtn').disabled = !!DATA.mpEnvLocked
    renderState(); renderBalance(); render()
  } catch (error) { $('app').style.display = 'none'; msg(String(error.message), true) }
}
function commonHeaders(first) {
  return '<tr><th>' + tr(first) + '</th><th>' + tr('runs') + '</th><th>' + tr('win') + '</th><th>' + tr('avgFloor') + '</th><th>' + tr('percentiles') + '</th>'
}
function summaryCells(row) {
  return '<td>' + row.runs + '</td><td>' + row.winRate + '%</td><td>' + row.avgFloor + '</td><td>' + row.p25Floor + '/' + row.medianFloor + '/' + row.p75Floor + '</td>'
}
function renderBalance() {
  if (!BALANCE || !BALANCE.runs) {
    $('balance').innerHTML = '<div class="muted source">' + tr('playerSource') + '</div><div class="empty">' + tr('waitingRuns') + '</div>'
    return
  }
  const charRows = (BALANCE.byChar || []).map((row) => '<tr><td>' + esc(String(row.id).toUpperCase()) + '</td>' + summaryCells(row) + '<td>' + deaths(row) + '</td><td>' + row.avgDeck + '/' + row.avgUpgrades + '/' + row.avgRelics + '</td></tr>').join('')
  const ascRows = (BALANCE.byAscension || []).map((row) => '<tr><td>A' + esc(row.id) + '</td>' + summaryCells(row) + '<td>' + deaths(row) + '</td></tr>').join('')
  const archRows = (BALANCE.byArchetype || []).slice(0,12).map((row) => '<tr><td>' + esc(row.id) + '</td>' + summaryCells(row) + '<td>' + row.avgScore + '</td></tr>').join('')
  const detail = tr('playerSummary', { accounts:BALANCE.accountsWithHistory, limit:BALANCE.retentionPerAccount || 100, runs:BALANCE.recent30d.runs, wins:BALANCE.recent30d.winRate, updated:fmt(BALANCE.generatedAt) })
  $('balance').innerHTML = '<div class="muted source">' + tr('playerSource') + '</div><div class="muted">' + detail + '</div>' +
    '<h3>' + tr('playerRuns') + '</h3><table><thead>' + commonHeaders('char') + '<th>' + tr('deathActs') + '</th><th>' + tr('deckUpRelic') + '</th></tr></thead><tbody>' + charRows + '</tbody></table>' +
    '<h3>' + tr('ascensionStats') + '</h3><table><thead>' + commonHeaders('ascension') + '<th>' + tr('deathActs') + '</th></tr></thead><tbody>' + ascRows + '</tbody></table>' +
    '<h3>' + tr('playerArchetypes') + '</h3>' + (archRows ? '<table><thead>' + commonHeaders('archetype') + '<th>' + tr('avgScore') + '</th></tr></thead><tbody>' + archRows + '</tbody></table>' : '<div class="empty">' + tr('waitingArchetypes') + '</div>')
}
function render() {
  if (!DATA) return
  const query = $('search').value.toLowerCase()
  $('rows').innerHTML = DATA.accounts.filter((account) => !query || account.user.includes(query) || account.name.toLowerCase().includes(query)).sort((a,b) => b.created-a.created).map((account) =>
    '<tr class="' + (account.banned ? 'banned' : '') + '"><td>' + esc(account.name) + '</td><td>' + fmt(account.created) + '</td><td>' + fmt(account.blobUpdated) + '</td><td>' + (account.banned ? tr('banned') : tr('ok')) + '</td><td>' +
    (account.cheatsEnabled ? '<span class="pill on">' + tr('enabled') + '</span>' : '<span class="pill off">' + tr('off') + '</span>') + '</td><td>' +
    '<button class="mini gold" onclick="cheats(\\'' + account.user + '\\',' + !account.cheatsEnabled + ')">' + tr(account.cheatsEnabled ? 'disableCheats' : 'enableCheats') + '</button>' +
    '<button class="mini" onclick="ban(\\'' + account.user + '\\',' + !account.banned + ')">' + tr(account.banned ? 'unban' : 'ban') + '</button>' +
    '<button class="mini" onclick="resetPw(\\'' + account.user + '\\')">' + tr('resetPw') + '</button>' +
    '<button class="mini warn" onclick="del(\\'' + account.user + '\\')">' + tr('deleteAccount') + '</button></td></tr>').join('')
}
async function ban(user, banned) { try { await api(API + '/ban','POST',{user,banned}); load() } catch(error) { msg(error.message,true) } }
async function cheats(user, enabled) { try { await api(API + '/cheats','POST',{user,enabled}); load() } catch(error) { msg(error.message,true) } }
async function resetPw(user) {
  const pass = prompt(tr('newPassword',{user}))
  if (!pass) return
  try { await api(API + '/reset','POST',{user,pass}); msg(tr('passwordReset',{user})) } catch(error) { msg(error.message,true) }
}
async function del(user) {
  if (!confirm(tr('deleteConfirm',{user}))) return
  try { await api(API + '/accounts/' + user,'DELETE'); load() } catch(error) { msg(error.message,true) }
}
async function toggleMode() { try { await api(API + '/mpmode','POST',{mode:DATA.mpMode === 'hybrid' ? 'strict' : 'hybrid'}); load() } catch(error) { msg(error.message,true) } }
async function toggleReg() { try { await api(API + '/registrations','POST',{open:!DATA.registrationsOpen}); load() } catch(error) { msg(error.message,true) } }
async function exportDb() {
  try { const db = await api(API + '/export'); const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([JSON.stringify(db,null,2)],{type:'application/json'})); link.download = 'neonspire-db-' + new Date().toISOString().slice(0,10) + '.json'; link.click() }
  catch(error) { msg(error.message,true) }
}
function importDb() {
  const input = $('importfile')
  input.onchange = async () => {
    const file = input.files && input.files[0]
    if (!file || !confirm(tr('importConfirm'))) return
    try { await api(API + '/import','POST',JSON.parse(await file.text())); msg(tr('imported')); load() } catch(error) { msg(error.message,true) }
  }
  input.click()
}
applyLanguage()
if (KEY) { $('key').value = KEY; load() }
</script></body></html>`
