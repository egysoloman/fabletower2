import { useState } from 'preact/hooks'
import type { CharId } from '@neonspire/engine'
import { ascUnlocked, newGame, runHistory } from '../game'
import { lastChar } from './charselect'
import { CharPickButton, CharSelectPage } from './mpsetup'
import { hasSave, loadGame, screen } from '../store'
import { screenWipe } from '../fx'
import { installPrompt, setSetting, settings } from '../settings'
import { account, cloudUrl, login, logout, register, setCloudUrl, syncMsg, syncUp } from '../account'
import { loadMods, mods, setModEnabled } from '../mods'
import { useState as useAccState } from 'preact/hooks'
import { muted, sfx, toggleMute } from '../sfx'
import { lang, t, tf, toggleLang } from '../i18n'
import { SoundIcon } from '../sprites'

export function MenuScreen() {
  const canContinue = hasSave()
  const history = runHistory().slice(0, 5)

  return (
    <div class="screen menu">
      <div>
        <div class="logo">
          NEON<span>SPIRE</span>
        </div>
        <div class="tagline" style={{ textAlign: 'center', marginTop: '10px' }}>
          {t('tagline')}
        </div>
      </div>

      <div class="menu-buttons">
        {canContinue && (
          <button
            class="btn"
            onClick={() => {
              sfx.click()
              if (!loadGame()) newGame()
            }}
          >
            {t('continueRun')}
          </button>
        )}
        <button class="btn big pink" onClick={() => (sfx.click(), screenWipe(t('newRun'), 'var(--pink)', () => (screen.value = 'newrun')))}>
          {t('newRun')}
        </button>
        <div class="mp-row">
          <button class="btn purple" onClick={() => (sfx.click(), screenWipe(t('pvpDuel'), 'var(--purple)', () => (screen.value = 'pvp')))}>
            {t('pvpDuel')}
          </button>
          <button
            class="btn"
            style={{ borderColor: 'var(--gold)', color: 'var(--gold)' }}
            onClick={() => (sfx.click(), screenWipe(t('climbRace'), 'var(--gold)', () => (screen.value = 'climb')))}
          >
            {t('climbRace')}
          </button>
          <button
            class="btn"
            style={{ borderColor: 'var(--green)', color: 'var(--green)' }}
            onClick={() => (sfx.click(), screenWipe(t('coopMode'), 'var(--green)', () => (screen.value = 'coop')))}
          >
            {t('coopMode')}
          </button>
        </div>
        <div class="seedrow">
          <button class="btn ghost" onClick={() => (sfx.click(), (screen.value = 'codex'))}>
            ▤ {t('codexBtn')}
          </button>
          <button class="btn ghost" onClick={() => (sfx.click(), (screen.value = 'settings'))}>
            ⚙ {t('settingsBtn')}
          </button>
          <button class="btn ghost" onClick={toggleLang}>
            {lang.value === 'zh' ? 'EN' : '中文'}
          </button>
          <button class="btn ghost" onClick={toggleMute}>
            <SoundIcon muted={muted.value} />
          </button>
        </div>
      </div>

      {history.length > 0 && (
        <div class="history">
          <div class="htitle">{t('historyTitle')}</div>
          {history.map((h, i) => (
            <div key={i} class="hrow">
              <span class={h.win ? 'hwin' : 'hloss'}>{h.win ? t('winShort') : t('lossShort')}</span>
              <span>{tf('actFloor', { act: h.act, floor: h.floor })}</span>
              {h.asc > 0 && <span>A{h.asc}</span>}
              {h.sc != null && <span class="hscore">{h.sc}</span>}
              <span class="hseed">#{h.seed}</span>
            </div>
          ))}
        </div>
      )}

      <small style={{ maxWidth: '460px', textAlign: 'center', lineHeight: 1.6 }}>{t('menuFooter')}</small>
    </div>
  )
}

/** Run-start loadout screen: pick your character, ascension and seed here. */
export function NewRunScreen() {
  const [seedText, setSeedText] = useState('')
  const [asc, setAsc] = useState(0)
  const [char, setChar] = useState<CharId>(lastChar())
  const [picking, setPicking] = useState(false)
  const maxAsc = ascUnlocked()

  const start = () => {
    sfx.click()
    const trimmed = seedText.trim()
    newGame(trimmed ? hashSeed(trimmed) : undefined, Math.min(asc, maxAsc), char)
  }

  const startDaily = () => {
    sfx.click()
    const today = new Date().toISOString().slice(0, 10)
    newGame(hashSeed('daily-' + today), 0, char)
  }

  if (picking) {
    return <CharSelectPage value={char} onChange={setChar} onDone={() => setPicking(false)} />
  }

  return (
    <div class="screen menu">
      <div class="logo" style={{ fontSize: 'clamp(26px,5vw,44px)' }}>
        JACK<span>IN</span>
      </div>

      <CharPickButton char={char} onOpen={() => setPicking(true)} />

      <div class="menu-buttons">
        <button class="btn big pink" onClick={start}>
          {t('startRun')}
          {asc > 0 ? `  ·  A${asc}` : ''}
        </button>
        {maxAsc > 0 && (
          <div class="ascrow">
            <button class="btn ghost" onClick={() => setAsc(Math.max(0, asc - 1))} disabled={asc === 0}>
              −
            </button>
            <span class="asclabel" data-tip={t('ascTip')}>
              {tf('ascLabel', { n: asc })} / {maxAsc}
            </span>
            <button class="btn ghost" onClick={() => setAsc(Math.min(maxAsc, asc + 1))} disabled={asc >= maxAsc}>
              +
            </button>
          </div>
        )}
        {asc > 0 && <div class="ascmod">{t(`ascMod${asc}` as Parameters<typeof t>[0])}</div>}
        <div class="seedrow">
          <input
            class="neon"
            placeholder={t('seedPlaceholder')}
            value={seedText}
            onInput={(e) => setSeedText((e.target as HTMLInputElement).value)}
          />
          <button class="btn" onClick={startDaily}>
            {t('dailyRun')}
          </button>
        </div>
        <button class="btn ghost" onClick={() => (sfx.click(), (screen.value = 'menu'))}>
          {t('back')}
        </button>
      </div>
    </div>
  )
}

function hashSeed(s: string): number {
  const asNum = Number(s)
  if (Number.isFinite(asNum) && s.length > 0 && /^\d+$/.test(s)) return asNum >>> 0
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Settings: paginated tabs — general, cloud account, mods. */
export function SettingsScreen() {
  const st = settings.value
  const [tab, setTab] = useState<'general' | 'account' | 'mods'>('general')
  const slider = (label: string, key: 'master' | 'sfx') => (
    <label class="setrow">
      <span>{label}</span>
      <input
        type="range"
        min="0"
        max="100"
        value={Math.round(st[key] * 100)}
        onInput={(e) => {
          setSetting(key, Number((e.target as HTMLInputElement).value) / 100)
          sfx.click()
        }}
      />
      <b>{Math.round(st[key] * 100)}%</b>
    </label>
  )
  return (
    <div class="screen menu">
      <div class="logo" style={{ fontSize: 'clamp(26px,5vw,44px)' }}>
        SET<span>UP</span>
      </div>
      <div class="mp-row">
        {(['general', 'account', 'mods'] as const).map((k) => (
          <button key={k} class={`btn ghost ${tab === k ? 'on' : ''}`} onClick={() => (sfx.click(), setTab(k))}>
            {t(('setTab_' + k) as Parameters<typeof t>[0])}
          </button>
        ))}
      </div>
      {tab === 'general' && (
      <div class="panel popin" key="general" style={{ minWidth: '340px' }}>
        {slider(t('setMaster'), 'master')}
        {slider(t('setSfx'), 'sfx')}
        <label class="setrow">
          <span>{t('setQuality')}</span>
          <span class="setopts">
            {(['high', 'medium', 'low'] as const).map((q) => (
              <button key={q} class={`btn ghost ${st.quality === q ? 'on' : ''}`} onClick={() => (setSetting('quality', q), sfx.click())}>
                {t(('q_' + q) as Parameters<typeof t>[0])}
              </button>
            ))}
          </span>
        </label>
        <label class="setrow">
          <span>{t('setShake')}</span>
          <button class="btn ghost" onClick={() => (setSetting('shake', !st.shake), sfx.click())}>
            {st.shake ? t('on') : t('off')}
          </button>
        </label>
        <label class="setrow">
          <span>{t('setLang')}</span>
          <button class="btn ghost" onClick={toggleLang}>
            {lang.value === 'zh' ? 'EN' : '中文'}
          </button>
        </label>
        <label class="setrow">
          <span>{t('setMute')}</span>
          <button class="btn ghost" onClick={toggleMute}>
            <SoundIcon muted={muted.value} />
          </button>
        </label>
        {installPrompt.value && (
          <button
            class="btn gold"
            style={{ borderColor: 'var(--gold)', color: 'var(--gold)', alignSelf: 'center' }}
            onClick={() => {
              void installPrompt.value?.prompt()
              installPrompt.value = null
            }}
          >
            {t('installApp')}
          </button>
        )}
      </div>
      )}
      {tab === 'account' && <AccountPanel key="account" />}
      {tab === 'mods' && <ModsPanel key="mods" />}
      <button class="btn ghost" onClick={() => (sfx.click(), (screen.value = 'menu'))}>
        {t('back')}
      </button>
    </div>
  )
}

/** Installed mods: JSON content packs, enable/disable + reload. */
function ModsPanel() {
  const list = mods.value
  return (
    <div class="panel popin" style={{ minWidth: '340px' }}>
      <h2>{t('modsTitle')}</h2>
      <div class="sub" style={{ color: 'var(--gold)' }}>{t('modsWarn')}</div>
      {list.length === 0 && <div class="sub">{t('modsNone')}</div>}
      {list.map((m) => (
        <div key={m.manifest.id} class="setrow" style={{ alignItems: 'flex-start' }}>
          <span style={{ textAlign: 'left' }}>
            <b style={{ fontFamily: 'var(--font-head)', fontSize: '12px' }}>
              {m.manifest.name} <small style={{ color: 'var(--dim)' }}>{m.manifest.version ?? ''}</small>
            </b>
            <small style={{ display: 'block', color: 'var(--dim)', maxWidth: '230px' }}>{m.manifest.description ?? ''}</small>
            {m.report && <small style={{ display: 'block', color: 'var(--green)' }}>{tf('modsAdded', { n: m.report.added.length })}</small>}
          </span>
          <button class={`btn ghost ${m.enabled ? 'on' : ''}`} onClick={() => (sfx.click(), setModEnabled(m.manifest.id, !m.enabled))}>
            {m.enabled ? t('on') : t('off')}
          </button>
        </div>
      ))}
      <button class="btn ghost" onClick={() => (sfx.click(), void loadMods())}>
        {t('modsReload')}
      </button>
    </div>
  )
}

/** Optional cloud account: guest mode is simply not logging in. */
function AccountPanel() {
  const [user, setUser] = useAccState('')
  const [pass, setPass] = useAccState('')
  const [err, setErr] = useAccState('')
  const [srv, setSrv] = useAccState(cloudUrl.value)
  const a = account.value
  const go = (fn: (u: string, p: string) => Promise<void>) => {
    setErr('')
    fn(user, pass).catch((e) => setErr(String(e.message)))
  }
  return (
    <div class="panel popin" style={{ minWidth: '340px' }}>
      <h2>{t('accTitle')}</h2>
      <div class="sub" style={{ color: 'var(--cyan)' }}>{t('setCloud')}</div>
      <input
        class="neon"
        placeholder={t('setCloudPh')}
        value={srv}
        onInput={(e) => setSrv((e.target as HTMLInputElement).value)}
        onBlur={() => {
          setCloudUrl(srv)
          setSrv(cloudUrl.value)
        }}
      />
      <div class="sub mp-hint">{t('setCloudHint')}</div>
      {a ? (
        <>
          <div class="sub">{tf('accHello', { name: a.name })}</div>
          <div class="sub" style={{ color: 'var(--green)' }}>{syncMsg.value}</div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button class="btn" onClick={() => void syncUp()}>{t('accSync')}</button>
            <button class="btn ghost" onClick={logout}>{t('accLogout')}</button>
          </div>
        </>
      ) : (
        <>
          <div class="sub">{t('accGuest')}</div>
          <input class="neon" placeholder={t('accUser')} value={user} maxLength={16} onInput={(e) => setUser((e.target as HTMLInputElement).value)} />
          <input class="neon" type="password" placeholder={t('accPass')} value={pass} onInput={(e) => setPass((e.target as HTMLInputElement).value)} />
          {err && <div class="sub" style={{ color: 'var(--red)' }}>{err}</div>}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button class="btn pink" onClick={() => go(login)}>{t('accLogin')}</button>
            <button class="btn" onClick={() => go(register)}>{t('accRegister')}</button>
          </div>
        </>
      )}
    </div>
  )
}
